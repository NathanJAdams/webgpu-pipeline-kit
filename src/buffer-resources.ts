import { bufferFactory, WPKTrackedBuffer } from './buffer-factory';
import { WPKBufferFormatKey, WPKBufferFormatMap } from './buffer-formats';
import { WPKEntityCache, WPKUniformCache } from './cache';
import { datumBatchEncoderFactory } from './datum-batch-encoder';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { logFactory } from './logging';
import { meshFuncs, WPKMesh } from './meshes';
import { WPKResource } from './resources';
import { strideFuncs } from './strides';
import { CopySlice, logFuncs, ValueSlices } from './utils';

type WPKMutator<T> = {
  mutate: (input: T) => void;
};

export type WPKMeshBufferResource = {
  indices: WPKResource<WPKTrackedBuffer>;
  vertices: WPKResource<WPKTrackedBuffer>;
};

export type WPKBufferResources<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  buffers: Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, WPKResource<WPKTrackedBuffer>>;
  instanceCount: () => number;
  update: () => void;
};

const LOGGER = logFactory.getLogger('buffer');

export const bufferResourcesFactory = {
  ofMesh: (name: string, mesh: WPKMesh): WPKMeshBufferResource => {
    LOGGER.debug(`Creating mesh buffer ${name}`);
    const indices = bufferFactory.ofData(meshFuncs.toIndicesData(mesh), `${name}-indices`, GPUBufferUsage.INDEX);
    const vertices = bufferFactory.ofData(meshFuncs.toVerticesData(mesh), `${name}-vertices`, GPUBufferUsage.VERTEX);
    return {
      indices,
      vertices,
    };
  },
  ofUniformAndInstances: <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    name: string,
    uniformCache: WPKUniformCache<TUniformFormat, any>,
    entityCache: WPKEntityCache<TEntityFormat, any, any>,
    bufferFormats: TBufferFormats,
    bufferUsages: Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, GPUBufferUsageFlags>,
  ): WPKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats> => {
    const initialInstances = entityCache.calculateChanges().values;
    const uniformMutators: WPKMutator<WPKInstanceOf<TUniformFormat>>[] = [];
    const buffers: Record<string, WPKResource<WPKTrackedBuffer>> = {};
    let instanceMutator: WPKMutator<ValueSlices<WPKInstanceOf<TEntityFormat>[]>> | undefined;
    logFuncs.lazyDebug(LOGGER, () => `Create buffer resources for ${name}`);
    for (const [key, bufferFormat] of Object.entries(bufferFormats)) {
      logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${key}`);
      const { bufferType, contentType } = bufferFormat;
      const usage = bufferUsages[key];
      const label = `${name}-buffer-${key}`;
      if (bufferType === 'uniform') {
        logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${key} of type uniform`);
        const datumBatchEncoder = datumBatchEncoderFactory.of(bufferFormat.marshall);
        if (uniformCache.isMutable) {
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${key}:uniform is mutable`);
          const stride = strideFuncs.ofFormatMarshall(bufferFormat.marshall);
          const buffer = bufferFactory.ofMutable(stride, label, usage);
          const uniformMutator: WPKMutator<WPKInstanceOf<TUniformFormat>> = {
            mutate(input) {
              const data = datumBatchEncoder.encode([input]);
              buffer.mutate(data, 0);
            },
          };
          buffers[key] = buffer;
          uniformMutators.push(uniformMutator);
        } else {
          logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${key}:uniform is not mutable`);
          const data = datumBatchEncoder.encode([uniformCache.get()]);
          const buffer = bufferFactory.ofData(data, label, usage);
          buffers[key] = buffer;
        }
      } else if (bufferType === 'entity') {
        if (contentType === 'layout') {
          logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${key} of type entity layout`);
          if (entityCache.isResizeable) {
            const stride = strideFuncs.ofFormatLayout(bufferFormat.layout);
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
            const stride = strideFuncs.ofFormatLayout(bufferFormat.layout);
            buffers[key] = bufferFactory.ofSize(entityCache.count() * stride, label, usage);
          }
        } else if (contentType === 'marshalled') {
          logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for ${name} key ${key} of type entity marshalled`);
          if (entityCache.isResizeable) {
            logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${key}:entity:marshalled is resizeable`);
            const buffer = bufferFactory.ofStaged(label, usage);
            buffers[key] = buffer;
            const stride = strideFuncs.ofFormatMarshall(bufferFormat.marshall);
            const datumBatchEncoder = datumBatchEncoderFactory.of(bufferFormat.marshall, entityCache);
            instanceMutator = {
              mutate(input) {
                const { copySlices, values } = input;
                const data = datumBatchEncoder.encode(values);
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
              const datumBatchEncoder = datumBatchEncoderFactory.of(bufferFormat.marshall);
              instanceMutator = {
                mutate(input) {
                  const { copySlices, values } = input;
                  const data = datumBatchEncoder.encode(values);
                  buffer.mutate(data, copySlices);
                },
              };
            } else {
              logFuncs.lazyTrace(LOGGER, () => `Buffer resources ${name}:${key}:entity:marshalled is not resizeable is not mutable`);
              const datumBatchEncoder = datumBatchEncoderFactory.of(bufferFormat.marshall);
              const data = datumBatchEncoder.encode(initialInstances);
              buffers[key] = bufferFactory.ofData(data, label, usage);
            }
          }
        } else {
          throw Error(`Cannot create buffer for unknown content type ${contentType}`);
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
