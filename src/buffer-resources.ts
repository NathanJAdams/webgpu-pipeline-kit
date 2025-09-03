import { bufferFactory } from './buffer-factory';
import { logFactory } from './logging';
import { marshallerFactory } from './marshall';
import { meshFuncs } from './mesh-factories';
import { DISPATCH_FORMAT } from './shader-reserved';
import { toStride } from './shader-utils';
import { WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferMutable, WPKBufferResources, WPKEntityCache, WPKMesh, WPKMeshBufferResource, WPKMutator, WPKResource, WPKTrackedBuffer, WPKUniformCache } from './types';
import { CopySlice, logFuncs, ValueSlices } from './utils';

const LOGGER = logFactory.getLogger('buffer');

export const bufferResourcesFactory = {
  ofDispatch: (name: string): WPKBufferMutable<number> & WPKResource<WPKTrackedBuffer> => {
    logFuncs.lazyDebug(LOGGER, () => `Creating dispatch buffer ${name}`);
    const stride = toStride(DISPATCH_FORMAT.marshall);
    return bufferFactory.ofMutable(stride, `${name}-buffer-dispatch`, GPUBufferUsage.UNIFORM);
  },
  ofMesh: (name: string, mesh: WPKMesh): WPKMeshBufferResource => {
    logFuncs.lazyDebug(LOGGER, () => `Creating mesh buffer ${name}`);
    const indices = bufferFactory.ofData(meshFuncs.toIndicesData(mesh), `${name}-indices`, GPUBufferUsage.INDEX);
    const vertices = bufferFactory.ofData(meshFuncs.toVerticesData(mesh), `${name}-vertices`, GPUBufferUsage.VERTEX);
    return {
      indices,
      vertices,
    };
  },
  ofUniformAndInstances: <TUniform, TEntity, TBufferFormats extends WPKBufferFormatMap<TUniform, TEntity>>(
    name: string,
    uniformCache: WPKUniformCache<TUniform, any>,
    entityCache: WPKEntityCache<TEntity, any, any>,
    bufferFormats: TBufferFormats,
    bufferUsages: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormats>, GPUBufferUsageFlags>,
  ): WPKBufferResources<TUniform, TEntity, TBufferFormats> => {
    const initialInstances = entityCache.calculateChanges().values;
    const uniformMutators: WPKMutator<TUniform>[] = [];
    const buffers: Record<string, WPKResource<WPKTrackedBuffer>> = {};
    let instanceMutator: WPKMutator<ValueSlices<TEntity[]>> | undefined;
    logFuncs.lazyDebug(LOGGER, () => `Create buffer resources for ${name}`);
    for (const [key, bufferFormat] of Object.entries(bufferFormats)) {
      logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${key}`);
      const { bufferType } = bufferFormat;
      const usage = bufferUsages[key];
      const label = `${name}-buffer-${key}`;
      if (bufferType === 'uniform') {
        logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${key} of type uniform`);
        const marshaller = marshallerFactory.ofMarshalled(bufferFormat);
        if (uniformCache.isMutable) {
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${key}:uniform is mutable`);
          const stride = toStride(bufferFormat.marshall);
          const buffer = bufferFactory.ofMutable(stride, label, usage);
          const uniformMutator: WPKMutator<TUniform> = {
            mutate(input) {
              const data = marshaller.encode([input]);
              buffer.mutate(data, 0);
            },
          };
          buffers[key] = buffer;
          uniformMutators.push(uniformMutator);
        } else {
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${key}:uniform is not mutable`);
          const data = marshaller.encode([uniformCache.get()]);
          const buffer = bufferFactory.ofData(data, label, usage);
          buffers[key] = buffer;
        }
      } else if (bufferType === 'editable') {
        logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${key} of type entity layout`);
        if (entityCache.isResizeable) {
          const stride = toStride(bufferFormat.layout);
          const buffer = bufferFactory.ofResizeable(false, label, usage);
          buffers[key] = buffer;
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
          const stride = toStride(bufferFormat.layout);
          buffers[key] = bufferFactory.ofSize(entityCache.count() * stride, label, usage);
        }
      } else if (bufferType === 'marshalled') {
        logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${key} of type entity marshalled`);
        if (entityCache.isResizeable) {
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${key}:entity:marshalled is resizeable`);
          const buffer = bufferFactory.ofStaged(label, usage);
          buffers[key] = buffer;
          const stride = toStride(bufferFormat.marshall);
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
            logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${key}:entity:marshalled is not resizeable is mutable`);
            const buffer = bufferFactory.ofStaged(label, usage);
            buffers[key] = buffer;
            const marshaller = marshallerFactory.ofMarshalled(bufferFormat);
            instanceMutator = {
              mutate(input) {
                const { copySlices, values } = input;
                const data = marshaller.encode(values);
                buffer.mutate(data, copySlices);
              },
            };
          } else {
            logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${key}:entity:marshalled is not resizeable is not mutable`);
            const marshaller = marshallerFactory.ofMarshalled(bufferFormat);
            const data = marshaller.encode(initialInstances);
            buffers[key] = bufferFactory.ofData(data, label, usage);
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
