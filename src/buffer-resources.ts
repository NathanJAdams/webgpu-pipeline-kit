import { WGBKBufferResourceHelpers } from './buffer-resource-helpers';
import { WGBKBufferFormats, WGBKResource, WGBKBufferType, WGBKBufferResources, WGBKMeshBufferResource, WGBKTrackedBuffer, WGBKMutableOptions, BufferContentType, WGBKBufferFormat, WGBKBufferFormatKey } from './buffer-resource-types';
import { WGBKExtractors } from './extractors';
import { WGBKInstanceFormat, WGBKInstanceOf } from './instance';
import { WGBKInstanceCache } from './InstanceCache';
import { WGBKStrides } from './strides';
import { WGBKUpdatedInstances } from './updated-instances';
import { BidiMap, ChangeDetectors, CopySlice, WGBKMesh, WGBKMeshes, ValueSlices } from './utils';

type WGBKMutator<T> = {
    mutate: (input: T) => void;
};

export const BufferResources = {
  toBufferBindingType: <TBufferType extends WGBKBufferType, TBufferContentType extends BufferContentType>(visibility: GPUShaderStageFlags, bufferFormat: WGBKBufferFormat<TBufferType, TBufferContentType>): GPUBufferBindingType =>
    bufferFormat.bufferType === 'uniform'
      ? 'uniform'
      : (visibility === GPUShaderStage.COMPUTE) && (bufferFormat.contentType === 'layout')
        ? 'storage'
        : 'read-only-storage',
  ofMesh: (name: string, mesh: WGBKMesh): WGBKMeshBufferResource => {
    const indices = WGBKBufferResourceHelpers.ofData(WGBKMeshes.toIndicesData(mesh), `${name}-indices`, GPUBufferUsage.INDEX);
    const vertices = WGBKBufferResourceHelpers.ofData(WGBKMeshes.toVerticesData(mesh), `${name}-vertices`, GPUBufferUsage.VERTEX);
    return {
      indices,
      vertices,
    };
  },
  ofUniformAndInstances: <
        TUniformFormat extends WGBKInstanceFormat,
        TEntityFormat extends WGBKInstanceFormat,
        TBufferFormats extends WGBKBufferFormats<TUniformFormat, TEntityFormat>,
        TMutableUniform extends boolean,
        TMutableInstances extends boolean,
        TResizeableInstances extends boolean,
    >(
    name: string,
    initialUniform: WGBKInstanceOf<TUniformFormat>,
    initialInstances: WGBKInstanceOf<TEntityFormat>[],
    bufferFormats: TBufferFormats,
    bufferUsages: Record<WGBKBufferFormatKey<TBufferFormats>, GPUBufferUsageFlags>,
    mutableOptions: WGBKMutableOptions<TMutableUniform, TMutableInstances, TResizeableInstances>,
  ): WGBKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, TMutableUniform, TMutableInstances, TResizeableInstances> => {
    const { isMutableUniform, isMutableInstances, isResizeableInstances } = mutableOptions;
    let nextUniform = initialUniform;
    const uniformChangeDetector = ChangeDetectors.ofTripleEquals(initialUniform);
    const uniformMutators: WGBKMutator<WGBKInstanceOf<TUniformFormat>>[] = [];
    const mutatedInstancesByIndex = new Map<number, WGBKInstanceOf<TEntityFormat>>;
    const instanceIdIndexes = new BidiMap<string, number>();
    const instanceMutators: WGBKMutator<ValueSlices<WGBKInstanceOf<TEntityFormat>[]>>[] = [];
    const instanceCache = new WGBKInstanceCache<WGBKInstanceOf<TEntityFormat>>();
    const buffers: Record<string, WGBKResource<WGBKTrackedBuffer>> = {};
    initialInstances.forEach((initialInstance) => instanceCache.add(initialInstance));
    for (const [key, bufferFormat] of Object.entries(bufferFormats)) {
      const { bufferType, contentType } = bufferFormat;
      const usage = bufferUsages[key];
      const label = `${name}-buffer-${key}`;
      if (bufferType === 'uniform') {
        const extractor = WGBKExtractors.of(bufferFormat.marshall);
        if (isMutableUniform) {
          const stride = WGBKStrides.ofMarshalledFormat(bufferFormat.marshall);
          const buffer = WGBKBufferResourceHelpers.ofMutable(stride, label, usage);
          const uniformMutator: WGBKMutator<WGBKInstanceOf<TUniformFormat>> = {
            mutate(input) {
              const data = extractor.extract([input]);
              buffer.mutate(data, 0);
            },
          };
          buffers[key] = buffer;
          uniformMutators.push(uniformMutator);
        } else {
          const data = extractor.extract([initialUniform]);
          const buffer = WGBKBufferResourceHelpers.ofData(data, label, usage);
          buffers[key] = buffer;
        }
      } else if (bufferType === 'entity') {
        if (contentType === 'layout') {
          if (isResizeableInstances) {
            const stride = WGBKStrides.ofLayout(bufferFormat.layout);
            const buffer = WGBKBufferResourceHelpers.ofResizeable(false, label, usage);
            buffers[key] = buffer;
            let maxInstanceCount = 0;
            const mutator: WGBKMutator<ValueSlices<WGBKInstanceOf<TEntityFormat>[]>> = {
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
            const stride = WGBKStrides.ofLayout(bufferFormat.layout);
            buffers[key] = WGBKBufferResourceHelpers.ofSize(initialInstances.length * stride, label, usage);
          }
        } else if (contentType === 'marshalled') {
          if (isResizeableInstances) {
            const buffer = WGBKBufferResourceHelpers.ofStaged(label, usage);
            buffers[key] = buffer;
            if (isMutableInstances) {
              const stride = WGBKStrides.ofMarshalledFormat(bufferFormat.marshall);
              const extractor = WGBKExtractors.of(bufferFormat.marshall);
              const mutator: WGBKMutator<ValueSlices<WGBKInstanceOf<TEntityFormat>[]>> = {
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
              const buffer = WGBKBufferResourceHelpers.ofStaged(label, usage);
              buffers[key] = buffer;
              const extractor = WGBKExtractors.of(bufferFormat.marshall);
              const mutator: WGBKMutator<ValueSlices<WGBKInstanceOf<TEntityFormat>[]>> = {
                mutate(input) {
                  const { copySlices, values } = input;
                  const data = extractor.extract(values);
                  buffer.mutate(data, copySlices);
                },
              };
              instanceMutators.push(mutator);
            } else {
              const extractor = WGBKExtractors.of(bufferFormat.marshall);
              const data = extractor.extract(initialInstances);
              buffers[key] = WGBKBufferResourceHelpers.ofData(data, label, usage);
            }
          }
        } else {
          throw Error(`Cannot create buffer for unknown content type ${contentType}`);
        }
      } else {
        throw Error(`Cannot create buffer for unknown buffer type ${bufferType}`);
      }
    }
    const bufferResources: WGBKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, boolean, boolean, boolean> = {
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
              const mutatedSlices = WGBKUpdatedInstances.byIdIndex(instanceIdIndexes, command);
              instanceMutators.forEach((instanceMutator) => instanceMutator.mutate(mutatedSlices));
            }
          }
        } else if (isMutableInstances) {
          if (mutatedInstancesByIndex.size > 0) {
            const mutatedSlices = WGBKUpdatedInstances.byIndex(mutatedInstancesByIndex);
            instanceMutators.forEach((instanceMutator) => instanceMutator.mutate(mutatedSlices));
            mutatedInstancesByIndex.clear();
          }
        }
      },
    };
    if (isMutableUniform) {
      const mutableUniformBufferResources = bufferResources as WGBKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, true, false, false>;
      mutableUniformBufferResources.mutateUniform = (uniform) => nextUniform = uniform;
    }
    if (isMutableInstances) {
      if (isResizeableInstances) {
        const mutableInstancesBufferResources = bufferResources as WGBKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, TMutableUniform, true, true>;
        mutableInstancesBufferResources.mutateInstanceById = (id, instance) => instanceCache.mutate(id, instance);
      } else {
        const mutableInstancesBufferResources = bufferResources as WGBKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, TMutableUniform, true, false>;
        mutableInstancesBufferResources.mutateInstanceByIndex = mutatedInstancesByIndex.set;
      }
    }
    if (isResizeableInstances) {
      const resizeableInstancesBufferResources = bufferResources as WGBKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, TMutableUniform, TMutableInstances, true>;
      resizeableInstancesBufferResources.add = (instance) => instanceCache.add(instance);
      resizeableInstancesBufferResources.remove = (instanceId) => instanceCache.remove(instanceId);
    }
    return bufferResources as WGBKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats, TMutableUniform, TMutableInstances, TResizeableInstances>;
  },
};
