import { bufferFactory, WPKTrackedBuffer } from './buffer-factory';
import { WPKBufferFormatKey, WPKBufferFormatMap } from './buffer-formats';
import { WPKEntityCache as WPKEntityCache, WPKUniformCache as WPKUniformCache } from './cache';
import { dataExtractorFactory } from './data-extractor';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { WPKMesh, meshFuncs } from './mesh';
import { WPKResource } from './resources';
import { strideFuncs } from './strides';
import { CopySlice, ValueSlices } from './utils';

type WPKMutator<T> = {
  mutate: (input: T) => void;
};

export type WPKMeshBufferResource = {
  indices: WPKResource<WPKTrackedBuffer>;
  vertices: WPKResource<WPKTrackedBuffer>;
};

export type WPKBufferResources<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  buffers: Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, WPKResource<WPKTrackedBuffer>>;
  instanceCount: number;
  update: () => void;
};

export const bufferResourcesFactory = {
  ofMesh: (name: string, mesh: WPKMesh): WPKMeshBufferResource => {
    const indices = bufferFactory.ofData(meshFuncs.toIndicesData(mesh), `${name}-indices`, GPUBufferUsage.INDEX);
    const vertices = bufferFactory.ofData(meshFuncs.toVerticesData(mesh), `${name}-vertices`, GPUBufferUsage.VERTEX);
    return {
      indices,
      vertices,
    };
  },
  ofUniformAndInstances: <
    TUniformFormat extends WPKInstanceFormat,
    TEntityFormat extends WPKInstanceFormat,
    TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>,
  >(
    name: string,
    uniformCache: WPKUniformCache<TUniformFormat, any>,
    entityCache: WPKEntityCache<TEntityFormat, any, any>,
    bufferFormats: TBufferFormats,
    bufferUsages: Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, GPUBufferUsageFlags>,
  ): WPKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats> => {
    const initialInstances = entityCache.calculateChanges().values;
    const uniformMutators: WPKMutator<WPKInstanceOf<TUniformFormat>>[] = [];
    const instanceMutators: WPKMutator<ValueSlices<WPKInstanceOf<TEntityFormat>[]>>[] = [];
    const buffers: Record<string, WPKResource<WPKTrackedBuffer>> = {};
    for (const [key, bufferFormat] of Object.entries(bufferFormats)) {
      const { bufferType, contentType } = bufferFormat;
      const usage = bufferUsages[key];
      const label = `${name}-buffer-${key}`;
      if (bufferType === 'uniform') {
        const extractor = dataExtractorFactory.of(bufferFormat.marshall);
        if (uniformCache.isMutable) {
          const stride = strideFuncs.ofFormatMarshall(bufferFormat.marshall);
          const buffer = bufferFactory.ofMutable(stride, label, usage);
          const uniformMutator: WPKMutator<WPKInstanceOf<TUniformFormat>> = {
            mutate(input) {
              const data = extractor.extract([input]);
              buffer.mutate(data, 0);
            },
          };
          buffers[key] = buffer;
          uniformMutators.push(uniformMutator);
        } else {
          const data = extractor.extract([uniformCache.get()]);
          const buffer = bufferFactory.ofData(data, label, usage);
          buffers[key] = buffer;
        }
      } else if (bufferType === 'entity') {
        if (contentType === 'layout') {
          if (entityCache.isResizeable) {
            const stride = strideFuncs.ofFormatLayout(bufferFormat.layout);
            const buffer = bufferFactory.ofResizeable(false, label, usage);
            buffers[key] = buffer;
            let maxInstanceCount = 0;
            const mutator: WPKMutator<ValueSlices<WPKInstanceOf<TEntityFormat>[]>> = {
              mutate(input) {
                const { copySlices } = input;
                const maxCopySliceIndex = copySlices.reduce((max, copySlice) => Math.max(max, copySlice.toIndex + copySlice.length), 0);
                maxInstanceCount = Math.max(maxInstanceCount, maxCopySliceIndex + 1);
                const bytesLength = maxInstanceCount * stride;
                buffer.resize(bytesLength);
              },
            };
            instanceMutators.push(mutator);
          } else {
            const stride = strideFuncs.ofFormatLayout(bufferFormat.layout);
            buffers[key] = bufferFactory.ofSize(entityCache.count * stride, label, usage);
          }
        } else if (contentType === 'marshalled') {
          if (entityCache.isResizeable) {
            const buffer = bufferFactory.ofStaged(label, usage);
            buffers[key] = buffer;
            if (entityCache.isMutable) {
              const stride = strideFuncs.ofFormatMarshall(bufferFormat.marshall);
              const extractor = dataExtractorFactory.of(bufferFormat.marshall);
              const mutator: WPKMutator<ValueSlices<WPKInstanceOf<TEntityFormat>[]>> = {
                mutate(input) {
                  const { copySlices, values } = input;
                  const data = extractor.extract(values);
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
              instanceMutators.push(mutator);
            }
          } else {
            if (entityCache.isMutable) {
              const buffer = bufferFactory.ofStaged(label, usage);
              buffers[key] = buffer;
              const extractor = dataExtractorFactory.of(bufferFormat.marshall);
              const mutator: WPKMutator<ValueSlices<WPKInstanceOf<TEntityFormat>[]>> = {
                mutate(input) {
                  const { copySlices, values } = input;
                  const data = extractor.extract(values);
                  buffer.mutate(data, copySlices);
                },
              };
              instanceMutators.push(mutator);
            } else {
              const extractor = dataExtractorFactory.of(bufferFormat.marshall);
              const data = extractor.extract(initialInstances);
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
      instanceCount: entityCache.count,
      update() {
        if (uniformCache.isDirty) {
          const uniform = uniformCache.get();
          uniformMutators.forEach((uniformMutator) => uniformMutator.mutate(uniform));
        }
        if (entityCache.isDirty) {
          const changes = entityCache.calculateChanges();
          instanceMutators.forEach((instanceMutator) => instanceMutator.mutate(changes));
        }
      },
    };
  },
};
