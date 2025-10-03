import { bufferFactory } from './buffer-factory';
import { getLogger } from './logging';
import { marshallerFactory } from './marshall';
import { meshFuncs } from './mesh-factories';
import { resourceFactory } from './resources';
import { WPKBufferFormatMap, WPKBufferLayoutEditable, WPKBufferLayouts, WPKBufferResources, WPKDispatchParamsDetail, WPKEntityCache, WPKMesh, WPKMeshBufferResource, WPKMutator, WPKResource, WPKTrackedBuffer, WPKUniformCache, WPKBufferLayoutUniform, WPKBufferLayoutMarshalled } from './types';
import { CopySlice, logFuncs, ValueSlices } from './utils';

const LOGGER = getLogger('buffer');

export const bufferResourcesFactory = {
  ofDispatch: <TEntryPoints extends string[]>(
    name: string,
    bufferLayout: WPKBufferLayoutUniform<WPKDispatchParamsDetail<TEntryPoints>>,
    params: WPKResource<WPKDispatchParamsDetail<TEntryPoints>>,
    requiresReadBack: boolean
  ): WPKResource<WPKTrackedBuffer> => {
    logFuncs.lazyDebug(LOGGER, () => `Creating dispatch buffer ${name}`);
    const label = toBufferLabel(name, 'dispatch');
    const { entries, stride, usage } = bufferLayout;
    const marshaller = marshallerFactory.ofLayoutEntries(entries);
    const dispatchBuffer = bufferFactory.ofMutable(stride, label, usage, requiresReadBack);
    return resourceFactory.ofCachedFromDependencies(
      [params] as const,
      (device, queue, encoder, values) => {
        const marshalledData = marshaller.encode([values[0]]);
        dispatchBuffer.mutate(marshalledData, 0);
        return dispatchBuffer.get(device, queue, encoder);
      }
    );
  },
  ofMesh: (name: string, mesh: WPKMesh, requiresReadBack: boolean): WPKMeshBufferResource => {
    logFuncs.lazyDebug(LOGGER, () => `Creating mesh buffer ${name}`);
    const indices = bufferFactory.ofData(meshFuncs.toIndicesData(mesh), `${name}-indices`, GPUBufferUsage.INDEX, requiresReadBack);
    const vertices = bufferFactory.ofData(meshFuncs.toVerticesData(mesh), `${name}-vertices`, GPUBufferUsage.VERTEX, requiresReadBack);
    return {
      indices,
      vertices,
    };
  },
  ofBufferLayouts: <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
    name: string,
    uniformCache: WPKUniformCache<TUniform, boolean>,
    entityCache: WPKEntityCache<TEntity, boolean, boolean>,
    bufferLayouts: WPKBufferLayouts<TUniform, TEntity>,
    requiresReadBack: boolean
  ): WPKBufferResources<TUniform, TEntity, TBufferFormatMap> => {
    const initialEntities = entityCache.calculateChanges().values;
    const uniformMutators: WPKMutator<TUniform>[] = [];
    const entityMutators: WPKMutator<ValueSlices<TEntity[]>>[] = [];
    const buffers: Record<string, WPKResource<WPKTrackedBuffer>> = {};
    logFuncs.lazyDebug(LOGGER, () => `Create buffer resources for ${name}`);
    logFuncs.lazyDebug(LOGGER, () => `Create uniform buffer resources for ${name}`);
    for (const [bufferName, bufferLayout] of Object.entries(bufferLayouts)) {
      const { bufferType } = bufferLayout;
      if (bufferType === 'uniform') {
        const uniformBufferResource = bufferResourcesFactory.ofUniform(name, bufferName, bufferLayout, uniformCache, requiresReadBack);
        if (Array.isArray(uniformBufferResource)) {
          const [buffer, mutator] = uniformBufferResource;
          buffers[bufferName] = buffer;
          uniformMutators.push(mutator);
        } else {
          buffers[bufferName] = uniformBufferResource;
        }
      } else {
        const bufferResource = (bufferType === 'editable')
          ? bufferResourcesFactory.ofEditable(name, bufferName, bufferLayout, entityCache, requiresReadBack)
          : (bufferType === 'marshalled')
            ? bufferResourcesFactory.ofMarshalled(name, bufferName, bufferLayout, entityCache, initialEntities, requiresReadBack)
            : undefined;
        if (bufferResource === undefined) {
          throw Error(`Unrecognized buffer type ${bufferType}`);
        }
        if (Array.isArray(bufferResource)) {
          const [buffer, mutator] = bufferResource;
          buffers[bufferName] = buffer;
          entityMutators.push(mutator);
        } else {
          buffers[bufferName] = bufferResource;
        }
      }
    }
    return {
      buffers,
      instanceCount: () => entityCache.count(),
      update() {
        if (uniformCache.isDirty()) {
          logFuncs.lazyTrace(LOGGER, () => 'Uniform cache is dirty, mutating uniform');
          const uniform = uniformCache.get();
          uniformMutators.forEach((uniformMutator) => uniformMutator.mutate(uniform));
        }
        if (entityCache.isDirty()) {
          logFuncs.lazyTrace(LOGGER, () => 'Entity cache is dirty, mutating entities');
          const changes = entityCache.calculateChanges();
          entityMutators.forEach((entityMutator) => entityMutator.mutate(changes));
        }
      },
    };
  },
  ofUniform: <TUniform>(name: string, bufferName: string, bufferLayout: WPKBufferLayoutUniform<TUniform>, uniformCache: WPKUniformCache<TUniform, any>, requiresReadBack: boolean): WPKResource<WPKTrackedBuffer> | [WPKResource<WPKTrackedBuffer>, WPKMutator<TUniform>] => {
    const label = toBufferLabel(name, bufferName);
    logFuncs.lazyDebug(LOGGER, () => `Creating uniform buffer resource for ${label} layout ${JSON.stringify(bufferLayout)}`);
    const { entries, stride, usage } = bufferLayout;
    const marshaller = marshallerFactory.ofLayoutEntries(entries);
    if (uniformCache.isMutable) {
      logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${label} is mutable`);
      const buffer = bufferFactory.ofMutable(stride, label, usage, requiresReadBack);
      const uniformMutator: WPKMutator<TUniform> = {
        mutate(input) {
          logFuncs.lazyTrace(LOGGER, () => `Mutating uniform buffer ${label} with new data ${JSON.stringify(input)}`);
          const data = marshaller.encode([input]);
          buffer.mutate(data, 0);
        },
      };
      return [buffer, uniformMutator];
    } else {
      logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${label} is not mutable`);
      const input = uniformCache.get();
      logFuncs.lazyTrace(LOGGER, () => `Creating uniform buffer ${label} with initial data ${JSON.stringify(input)}`);
      const data = marshaller.encode([input]);
      const buffer = bufferFactory.ofData(data, label, usage, requiresReadBack);
      return buffer;
    }
  },
  ofEditable: <TEntity>(name: string, bufferName: string, bufferLayout: WPKBufferLayoutEditable, entityCache: WPKEntityCache<TEntity, any, any>, requiresReadBack: boolean): WPKResource<WPKTrackedBuffer> | [WPKResource<WPKTrackedBuffer>, WPKMutator<ValueSlices<TEntity[]>>] => {
    const label = toBufferLabel(name, bufferName);
    logFuncs.lazyDebug(LOGGER, () => `Create editable buffer resource for ${label} layout ${JSON.stringify(bufferLayout)}`);
    const { stride, usage } = bufferLayout;
    if (entityCache.isResizeable) {
      logFuncs.lazyTrace(LOGGER, () => `Creating resizeable buffer ${label} with stride ${stride}`);
      const buffer = bufferFactory.ofResizeable(false, label, usage, requiresReadBack);
      let maxInstanceCount = 0;
      const entityMutator: WPKMutator<ValueSlices<TEntity[]>> = {
        mutate(input) {
          const { copySlices } = input;
          logFuncs.lazyTrace(LOGGER, () => `Mutating resizeable buffer ${label} with input ${JSON.stringify(input)}`);
          const maxCopySliceIndex = copySlices.reduce((max, copySlice) => Math.max(max, copySlice.toIndex + copySlice.length), 0);
          maxInstanceCount = Math.max(maxInstanceCount, maxCopySliceIndex + 1);
          const bytesLength = maxInstanceCount * stride;
          logFuncs.lazyTrace(LOGGER, () => `Resizing buffer ${label} to desired bytes length ${bytesLength}`);
          buffer.resize(bytesLength);
        },
      };
      return [buffer, entityMutator];
    } else {
      logFuncs.lazyTrace(LOGGER, () => `Creating fixed size buffer ${label} with stride ${stride}`);
      return bufferFactory.ofSize(entityCache.count() * stride, label, usage, requiresReadBack);
    }
  },
  ofMarshalled: <TEntity>(name: string, bufferName: string, bufferLayout: WPKBufferLayoutMarshalled<TEntity>, entityCache: WPKEntityCache<TEntity, any, any>, initialEntities: TEntity[], requiresReadBack: boolean): WPKResource<WPKTrackedBuffer> | [WPKResource<WPKTrackedBuffer>, WPKMutator<ValueSlices<TEntity[]>>] => {
    const label = toBufferLabel(name, bufferName);
    logFuncs.lazyDebug(LOGGER, () => `Create marshalled buffer resources for ${label} layout ${JSON.stringify(bufferLayout)}`);
    const { entries, stride, usage } = bufferLayout;
    if (entityCache.isResizeable) {
      const buffer = bufferFactory.ofStaged(label, usage, requiresReadBack);
      logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${label} is resizeable with stride ${stride}`);
      const marshaller = marshallerFactory.ofLayoutEntries(entries);
      const entityMutator: WPKMutator<ValueSlices<TEntity[]>> = {
        mutate(input) {
          logFuncs.lazyTrace(LOGGER, () => `Mutating buffer ${label} with input ${JSON.stringify(input)}`);
          const { copySlices, values } = input;
          const data = marshaller.encode(values);
          const targetSlices = copySlices.map((copySlice): CopySlice => {
            return {
              length: copySlice.length * stride,
              min: copySlice.min * stride,
              toIndex: copySlice.toIndex * stride,
            };
          });
          logFuncs.lazyTrace(LOGGER, () => `Mutating resizeable buffer ${label} with data ${JSON.stringify(targetSlices)}`);
          buffer.mutate(data, targetSlices);
        },
      };
      return [buffer, entityMutator];
    } else {
      if (entityCache.isMutable) {
        logFuncs.lazyDebug(LOGGER, () => `Buffer resources ${label} is not resizeable is mutable`);
        const buffer = bufferFactory.ofStaged(label, usage, requiresReadBack);
        const marshaller = marshallerFactory.ofLayoutEntries(entries);
        const entityMutator: WPKMutator<ValueSlices<TEntity[]>> = {
          mutate(input) {
            logFuncs.lazyTrace(LOGGER, () => `Mutating buffer ${label} with input ${JSON.stringify(input)}`);
            const { copySlices, values } = input;
            const data = marshaller.encode(values);
            buffer.mutate(data, copySlices);
          },
        };
        return [buffer, entityMutator];
      } else {
        logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${label} is not resizeable is not mutable`);
        const marshaller = marshallerFactory.ofLayoutEntries(entries);
        const data = marshaller.encode(initialEntities);
        logFuncs.lazyTrace(LOGGER, () => `Creating buffer ${label} with data ${JSON.stringify(data)}`);
        return bufferFactory.ofData(data, label, usage, requiresReadBack);
      }
    }
  },
};

const toBufferLabel = (name: string, bufferName: string): string => `${name}-buffer-${bufferName}`;
