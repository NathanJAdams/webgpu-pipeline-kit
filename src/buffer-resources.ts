import { bufferFactory } from './buffer-factory';
import { logFactory } from './logging';
import { marshallerFactory } from './marshall';
import { meshFuncs } from './mesh-factories';
import { resourceFactory } from './resources';
import { shaderFuncs } from './shader-utils';
import { WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatUniform, WPKBufferResources, WPKDispatchParams, WPKEntityCache, WPKMarshaller, WPKMesh, WPKMeshBufferResource, WPKMutator, WPKResource, WPKTrackedBuffer, WPKUniformCache } from './types';
import { CopySlice, logFuncs, ValueSlices } from './utils';

const LOGGER = logFactory.getLogger('buffer');

export const bufferResourcesFactory = {
  ofDispatch: <TEntryPoints extends string[]>(
    name: string,
    format: WPKBufferFormatUniform<WPKDispatchParams<TEntryPoints>>,
    params: WPKResource<WPKDispatchParams<TEntryPoints>>,
    marshaller: WPKMarshaller<WPKDispatchParams<TEntryPoints>>,
    debuggable: boolean
  ): WPKResource<WPKTrackedBuffer> => {
    logFuncs.lazyDebug(LOGGER, () => `Creating dispatch buffer ${name}`);
    const stride = shaderFuncs.toStrideArray(format.marshall);
    const dispatchBuffer = bufferFactory.ofMutable(stride, `${name}-buffer-dispatch`, GPUBufferUsage.UNIFORM, debuggable);
    return resourceFactory.ofCachedFromDependencies(
      [params] as const,
      (device, queue, encoder, values) => {
        const marshalledData = marshaller.encode([values[0]]);
        dispatchBuffer.mutate(marshalledData, 0);
        return dispatchBuffer.get(device, queue, encoder);
      }
    );
  },
  ofMesh: (name: string, mesh: WPKMesh, debuggable: boolean): WPKMeshBufferResource => {
    logFuncs.lazyDebug(LOGGER, () => `Creating mesh buffer ${name}`);
    const indices = bufferFactory.ofData(meshFuncs.toIndicesData(mesh), `${name}-indices`, GPUBufferUsage.INDEX, debuggable);
    const vertices = bufferFactory.ofData(meshFuncs.toVerticesData(mesh), `${name}-vertices`, GPUBufferUsage.VERTEX, debuggable);
    return {
      indices,
      vertices,
    };
  },
  ofUniformAndInstances: <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
    name: string,
    uniformCache: WPKUniformCache<TUniform, boolean>,
    entityCache: WPKEntityCache<TEntity, boolean, boolean>,
    bufferFormats: TBufferFormatMap,
    bufferUsages: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, boolean, boolean>, GPUBufferUsageFlags>,
    debuggable: boolean
  ): WPKBufferResources<TUniform, TEntity, TBufferFormatMap> => {
    const initialInstances = entityCache.calculateChanges().values;
    const uniformMutators: WPKMutator<TUniform>[] = [];
    const entityMutators: WPKMutator<ValueSlices<TEntity[]>>[] = [];
    const buffers: Record<string, WPKResource<WPKTrackedBuffer>> = {};
    logFuncs.lazyDebug(LOGGER, () => `Create buffer resources for ${name}`);
    for (const [bufferName, bufferFormat] of Object.entries(bufferFormats)) {
      logFuncs.lazyTrace(LOGGER, () => `Creating buffer resource for format ${JSON.stringify(bufferFormat)}`);
      const { bufferType } = bufferFormat;
      const usage = bufferUsages[bufferName as WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, boolean, boolean>];
      const label = `${name}-buffer-${bufferName}`;
      logFuncs.lazyDebug(LOGGER, () => `Create buffer resources for ${label}`);
      if (bufferType === 'uniform') {
        logFuncs.lazyDebug(LOGGER, () => `Create buffer resources for ${label} of type uniform`);
        const marshaller = marshallerFactory.ofMarshalled(bufferFormat);
        if (uniformCache.isMutable) {
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${label} is mutable`);
          const stride = shaderFuncs.toStrideArray(bufferFormat.marshall);
          const buffer = bufferFactory.ofMutable(stride, label, usage, debuggable);
          const uniformMutator: WPKMutator<TUniform> = {
            mutate(input) {
              logFuncs.lazyTrace(LOGGER, () => `Mutating uniform buffer ${label} with new data ${JSON.stringify(input)}`);
              const data = marshaller.encode([input]);
              buffer.mutate(data, 0);
            },
          };
          buffers[bufferName] = buffer;
          uniformMutators.push(uniformMutator);
        } else {
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${label} is not mutable`);
          const input = uniformCache.get();
          logFuncs.lazyTrace(LOGGER, () => `Creating uniform buffer ${label} with initial data ${JSON.stringify(input)}`);
          const data = marshaller.encode([input]);
          const buffer = bufferFactory.ofData(data, label, usage, debuggable);
          buffers[bufferName] = buffer;
        }
      } else if (bufferType === 'editable') {
        logFuncs.lazyDebug(LOGGER, () => `Create buffer resources for ${label} of type entity editable`);
        if (entityCache.isResizeable) {
          const stride = shaderFuncs.toStrideArray(bufferFormat.layout);
          logFuncs.lazyTrace(LOGGER, () => `Creating resizeable buffer ${label} with stride ${stride}`);
          const buffer = bufferFactory.ofResizeable(false, label, usage, debuggable);
          buffers[bufferName] = buffer;
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
          entityMutators.push(entityMutator);
        } else {
          const stride = shaderFuncs.toStrideArray(bufferFormat.layout);
          logFuncs.lazyDebug(LOGGER, () => `Creating fixed size buffer ${label} with stride ${stride}`);
          buffers[bufferName] = bufferFactory.ofSize(entityCache.count() * stride, label, usage, debuggable);
        }
      } else if (bufferType === 'marshalled') {
        logFuncs.lazyDebug(LOGGER, () => `Create buffer resources for ${label} of type entity marshalled`);
        if (entityCache.isResizeable) {
          const buffer = bufferFactory.ofStaged(label, usage, debuggable);
          buffers[bufferName] = buffer;
          const stride = shaderFuncs.toStrideArray(bufferFormat.marshall);
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${label} is resizeable with stride ${stride}`);
          const marshaller = marshallerFactory.ofMarshalled(bufferFormat, entityCache);
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
          entityMutators.push(entityMutator);
        } else {
          if (entityCache.isMutable) {
            logFuncs.lazyDebug(LOGGER, () => `Buffer resources ${label} is not resizeable is mutable`);
            const buffer = bufferFactory.ofStaged(label, usage, debuggable);
            buffers[bufferName] = buffer;
            const marshaller = marshallerFactory.ofMarshalled(bufferFormat);
            const entityMutator: WPKMutator<ValueSlices<TEntity[]>> = {
              mutate(input) {
                logFuncs.lazyTrace(LOGGER, () => `Mutating buffer ${label} with input ${JSON.stringify(input)}`);
                const { copySlices, values } = input;
                const data = marshaller.encode(values);
                buffer.mutate(data, copySlices);
              },
            };
            entityMutators.push(entityMutator);
          } else {
            logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${label} is not resizeable is not mutable`);
            const marshaller = marshallerFactory.ofMarshalled(bufferFormat);
            const data = marshaller.encode(initialInstances);
            logFuncs.lazyTrace(LOGGER, () => `Creating buffer ${label} with data ${JSON.stringify(data)}`);
            buffers[bufferName] = bufferFactory.ofData(data, label, usage, debuggable);
          }
        }
      } else {
        throw Error(`Cannot create buffer for unknown buffer type ${bufferType}`);
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
};
