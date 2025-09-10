import { bufferFactory } from './buffer-factory';
import { logFactory } from './logging';
import { marshallerFactory } from './marshall';
import { meshFuncs } from './mesh-factories';
import { DISPATCH_FORMAT } from './shader-reserved';
import { shaderFuncs } from './shader-utils';
import { WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferResources, WPKDispatchBuffer, WPKEntityCache, WPKMesh, WPKMeshBufferResource, WPKMutator, WPKResource, WPKTrackedBuffer, WPKUniformCache } from './types';
import { CopySlice, logFuncs, ValueSlices } from './utils';

const LOGGER = logFactory.getLogger('buffer');

export const bufferResourcesFactory = {
  ofDispatch: (name: string, debuggable: boolean): WPKDispatchBuffer => {
    logFuncs.lazyDebug(LOGGER, () => `Creating dispatch buffer ${name}`);
    const stride = shaderFuncs.toStrideArray(DISPATCH_FORMAT.marshall);
    return bufferFactory.ofMutable(stride, `${name}-buffer-dispatch`, GPUBufferUsage.UNIFORM, debuggable);
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
    const buffers: Record<string, WPKResource<WPKTrackedBuffer>> = {};
    let instanceMutator: WPKMutator<ValueSlices<TEntity[]>> | undefined;
    logFuncs.lazyDebug(LOGGER, () => `Create buffer resources for ${name}`);
    for (const [bufferName, bufferFormat] of Object.entries(bufferFormats)) {
      logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${bufferName}`);
      const { bufferType } = bufferFormat;
      const usage = bufferUsages[bufferName as WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, boolean, boolean>];
      const label = `${name}-buffer-${bufferName}`;
      if (bufferType === 'uniform') {
        logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${bufferName} of type uniform`);
        const marshaller = marshallerFactory.ofMarshalled(bufferFormat);
        if (uniformCache.isMutable) {
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${bufferName}:uniform is mutable`);
          const stride = shaderFuncs.toStrideArray(bufferFormat.marshall);
          const buffer = bufferFactory.ofMutable(stride, label, usage, debuggable);
          const uniformMutator: WPKMutator<TUniform> = {
            mutate(input) {
              const data = marshaller.encode([input]);
              buffer.mutate(data, 0);
            },
          };
          buffers[bufferName] = buffer;
          uniformMutators.push(uniformMutator);
        } else {
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${bufferName}:uniform is not mutable`);
          const data = marshaller.encode([uniformCache.get()]);
          const buffer = bufferFactory.ofData(data, label, usage, debuggable);
          buffers[bufferName] = buffer;
        }
      } else if (bufferType === 'editable') {
        logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${bufferName} of type entity layout`);
        if (entityCache.isResizeable) {
          const stride = shaderFuncs.toStrideArray(bufferFormat.layout);
          const buffer = bufferFactory.ofResizeable(false, label, usage, debuggable);
          buffers[bufferName] = buffer;
          let maxInstanceCount = 0;
          instanceMutator = {
            mutate(input) {
              const { copySlices } = input;
              const maxCopySliceIndex = copySlices.reduce((max, copySlice) => Math.max(max, copySlice.toIndex + copySlice.length), 0);
              maxInstanceCount = Math.max(maxInstanceCount, maxCopySliceIndex + 1);
              const bytesLength = maxInstanceCount * stride;
              buffer.resize(bytesLength);
            },
          };
        } else {
          const stride = shaderFuncs.toStrideArray(bufferFormat.layout);
          buffers[bufferName] = bufferFactory.ofSize(entityCache.count() * stride, label, usage, debuggable);
        }
      } else if (bufferType === 'marshalled') {
        logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${bufferName} of type entity marshalled`);
        if (entityCache.isResizeable) {
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${bufferName}:entity:marshalled is resizeable`);
          const buffer = bufferFactory.ofStaged(label, usage, debuggable);
          buffers[bufferName] = buffer;
          const stride = shaderFuncs.toStrideArray(bufferFormat.marshall);
          const marshaller = marshallerFactory.ofMarshalled(bufferFormat, entityCache);
          instanceMutator = {
            mutate(input) {
              const { copySlices, values } = input;
              const data = marshaller.encode(values);
              const targetSlices = copySlices.map((copySlice): CopySlice => {
                return {
                  length: copySlice.length * stride,
                  min: copySlice.min * stride,
                  toIndex: copySlice.toIndex * stride,
                };
              });
              buffer.mutate(data, targetSlices);
            },
          };
        } else {
          if (entityCache.isMutable) {
            logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${bufferName}:entity:marshalled is not resizeable is mutable`);
            const buffer = bufferFactory.ofStaged(label, usage, debuggable);
            buffers[bufferName] = buffer;
            const marshaller = marshallerFactory.ofMarshalled(bufferFormat);
            instanceMutator = {
              mutate(input) {
                const { copySlices, values } = input;
                const data = marshaller.encode(values);
                buffer.mutate(data, copySlices);
              },
            };
          } else {
            logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${bufferName}:entity:marshalled is not resizeable is not mutable`);
            const marshaller = marshallerFactory.ofMarshalled(bufferFormat);
            const data = marshaller.encode(initialInstances);
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
          logFuncs.lazyTrace(LOGGER, () => 'Entity cache is dirty, mutating uniform');
          const changes = entityCache.calculateChanges();
          if (instanceMutator !== undefined) {
            instanceMutator.mutate(changes);
          } else {
            throw Error(`Cannot mutate dirty buffer resource ${name}`);
          }
        }
      },
    };
  },
};
