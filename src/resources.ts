import { WPKResource } from './types';
import { arrayFuncs } from './utils';

export const resourceFactory = {
  ofCached: <T>(resource: WPKResource<T>): WPKResource<T> => {
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
  ofFunc: <T>(func: () => T, isDirty: () => boolean = () => true): WPKResource<T> => {
    let object: T | undefined;
    return {
      get(_device, _queue, _encoder) {
        if (object === undefined || isDirty()) {
          object = func();
        }
        return object;
      },
    };
  },
  ofArray: <T>(resources: WPKResource<T>[]): WPKResource<T[]> => {
    return {
      get(device, queue, encoder) {
        return resources.map((resource) => resource.get(device, queue, encoder));
      },
    };
  },
  ofCachedFromDependencies: <DependencyResources extends readonly WPKResource<any>[], T>(
    dependencyResources: DependencyResources,
    createWithValues: (
      device: GPUDevice,
      queue: GPUQueue,
      encoder: GPUCommandEncoder,
      values: { [K in keyof DependencyResources]: DependencyResources[K] extends WPKResource<infer R> ? R : never },
    ) => T
  ): WPKResource<T> => {
    let cachedValue: T | undefined;
    let lastDependencies: any[] = [];
    return {
      get(device, queue, encoder) {
        const currentDependencies = dependencyResources.map((dependencyResource) => dependencyResource.get(device, queue, encoder));
        if (!arrayFuncs.equals(lastDependencies, currentDependencies) || cachedValue === undefined) {
          cachedValue = createWithValues(device, queue, encoder, currentDependencies as any);
          lastDependencies = currentDependencies;
        }
        return cachedValue;
      },
    };
  },
};
