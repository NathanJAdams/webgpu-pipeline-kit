import { bufferFactory } from './buffer-factory';
import { WPKBufferFormatKey, WPKBufferFormatMap } from './buffer-format';
import { WPKBufferResources, WPKMeshBufferResource, WPKMutableOptions, WPKTrackedBuffer } from './buffers';
import { dataExtractorFactory } from './data-extractor';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { WPKInstanceCache } from './InstanceCache';
import { WPKMesh, meshFuncs } from './mesh';
import { strideFuncs } from './strides';
import { WPKResource } from './types';
import { updatedInstancesFuncs } from './updated-instances';
import { BidiMap, changeDetectorFactory, CopySlice, ValueSlices } from './utils';

type WPKMutator<T> = {
    mutate: (input: T) => void;
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
        TMutableUniform extends boolean,
        TMutableInstances extends boolean,
        TResizeableInstances extends boolean,
    >(
    name: string,
    initialUniform: WPKInstanceOf<TUniformFormat>,
    initialInstances: WPKInstanceOf<TEntityFormat>[],
    bufferFormats: TBufferFormats,
    bufferUsages: Record<WPKBufferFormatKey<TBufferFormats>, GPUBufferUsageFlags>,
    mutableOptions: WPKMutableOptions<TMutableUniform, TMutableInstances, TResizeableInstances>,
  ): WPKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, TMutableUniform, TMutableInstances, TResizeableInstances> => {
    const { isMutableUniform, isMutableInstances, isResizeableInstances } = mutableOptions;
    let nextUniform = initialUniform;
    const uniformChangeDetector = changeDetectorFactory.ofTripleEquals(initialUniform);
    const uniformMutators: WPKMutator<WPKInstanceOf<TUniformFormat>>[] = [];
    const mutatedInstancesByIndex = new Map<number, WPKInstanceOf<TEntityFormat>>;
    const instanceIdIndexes = new BidiMap<string, number>();
    const instanceMutators: WPKMutator<ValueSlices<WPKInstanceOf<TEntityFormat>[]>>[] = [];
    const instanceCache = new WPKInstanceCache<WPKInstanceOf<TEntityFormat>>();
    const buffers: Record<string, WPKResource<WPKTrackedBuffer>> = {};
    initialInstances.forEach((initialInstance) => instanceCache.add(initialInstance));
    for (const [key, bufferFormat] of Object.entries(bufferFormats)) {
      const { bufferType, contentType } = bufferFormat;
      const usage = bufferUsages[key];
      const label = `${name}-buffer-${key}`;
      if (bufferType === 'uniform') {
        const extractor = dataExtractorFactory.of(bufferFormat.marshall);
        if (isMutableUniform) {
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
          const data = extractor.extract([initialUniform]);
          const buffer = bufferFactory.ofData(data, label, usage);
          buffers[key] = buffer;
        }
      } else if (bufferType === 'entity') {
        if (contentType === 'layout') {
          if (isResizeableInstances) {
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
            buffers[key] = bufferFactory.ofSize(initialInstances.length * stride, label, usage);
          }
        } else if (contentType === 'marshalled') {
          if (isResizeableInstances) {
            const buffer = bufferFactory.ofStaged(label, usage);
            buffers[key] = buffer;
            if (isMutableInstances) {
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
            if (isMutableInstances) {
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
    const bufferResources: WPKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, boolean, boolean, boolean> = {
      buffers,
      instanceCount: () => isResizeableInstances
        ? instanceCache.count()
        : initialInstances.length,
      update() {
        if (isMutableUniform && uniformChangeDetector.compareAndUpdate(nextUniform)) {
          uniformMutators.forEach((uniformMutator) => uniformMutator.mutate(nextUniform));
        }
        if (isResizeableInstances) {
          if (instanceCache.isDirty()) {
            const command = instanceCache.command();
            if (command.added.size > 0 || command.mutated.size > 0 || command.removed.size > 0) {
              const mutatedSlices = updatedInstancesFuncs.byIdIndex(instanceIdIndexes, command);
              instanceMutators.forEach((instanceMutator) => instanceMutator.mutate(mutatedSlices));
            }
          }
        } else if (isMutableInstances) {
          if (mutatedInstancesByIndex.size > 0) {
            const mutatedSlices = updatedInstancesFuncs.byIndex(mutatedInstancesByIndex);
            instanceMutators.forEach((instanceMutator) => instanceMutator.mutate(mutatedSlices));
            mutatedInstancesByIndex.clear();
          }
        }
      },
    };
    if (isMutableUniform) {
      const mutableUniformBufferResources = bufferResources as WPKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, true, false, false>;
      mutableUniformBufferResources.mutateUniform = (uniform) => nextUniform = uniform;
    }
    if (isMutableInstances) {
      if (isResizeableInstances) {
        const mutableInstancesBufferResources = bufferResources as WPKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, TMutableUniform, true, true>;
        mutableInstancesBufferResources.mutateInstanceById = (id, instance) => instanceCache.mutate(id, instance);
      } else {
        const mutableInstancesBufferResources = bufferResources as WPKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, TMutableUniform, true, false>;
        mutableInstancesBufferResources.mutateInstanceByIndex = mutatedInstancesByIndex.set;
      }
    }
    if (isResizeableInstances) {
      const resizeableInstancesBufferResources = bufferResources as WPKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, TMutableUniform, TMutableInstances, true>;
      resizeableInstancesBufferResources.add = (instance) => instanceCache.add(instance);
      resizeableInstancesBufferResources.remove = (instanceId) => instanceCache.remove(instanceId);
    }
    return bufferResources as WPKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, TMutableUniform, TMutableInstances, TResizeableInstances>;
  },
};
