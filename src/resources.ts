import { WGBKResource } from './buffer-resource-types';
import { ArrayFuncs } from './utils';

export const Resources = {
  ofCached: <T>(resource: WGBKResource<T>): WGBKResource<T> => {
    let object: T | undefined;
    return {
      get(device, queue, encoder) {
        if (object === undefined) {
          object = resource.get(device, queue, encoder);
        }
        return object;
      },
    };
  },
  ofArray: <T>(resources: WGBKResource<T>[]): WGBKResource<T[]> => {
    return {
      get(device, queue, encoder) {
        return resources.map((resource) => resource.get(device, queue, encoder));
      },
    };
  },
  ofCachedFromDependencies: <DependencyResources extends readonly WGBKResource<any>[], T>(
    dependencyResources: DependencyResources,
    createWithValues: (
      device: GPUDevice,
      queue: GPUQueue,
      encoder: GPUCommandEncoder,
      values: { [K in keyof DependencyResources]: DependencyResources[K] extends WGBKResource<infer R> ? R : never },
    ) => T
  ): WGBKResource<T> => {
    let cachedValue: T | undefined;
    let lastDependencies: any[] = [];
    return {
      get(device, queue, encoder) {
        const currentDependencies = dependencyResources.map((dependencyResource) => dependencyResource.get(device, queue, encoder));
        if (!ArrayFuncs.equals(lastDependencies, currentDependencies) || cachedValue === undefined) {
          cachedValue = createWithValues(device, queue, encoder, currentDependencies as any);
          lastDependencies = currentDependencies;
        }
        return cachedValue;
      },
    };
  },
};
