import { WPKResource } from './types';
import { arrayFuncs } from './utils';

export const resourceFactory = {
  ofCached: <T>(resource: WPKResource<T>): WPKResource<T> => {
    let object: T | undefined;
    return {
      update(device, queue, encoder) {
        if (object === undefined) {
          object = resource.update(device, queue, encoder);
        }
        return object;
      },
      get() {
        return resource.get();
      },
      clean() {
        object = undefined;
        resource.clean();
      },
    };
  },
  ofFunc: <T>(func: () => T, isDirty: () => boolean = () => true): WPKResource<T> => {
    let object: T | undefined;
    return {
      update(_device, _queue, _encoder) {
        if (object === undefined || isDirty()) {
          object = func();
        }
        return object;
      },
      get() {
        return resourceFactory.getOrThrow(object, 'resource func');
      },
      clean() {
        object = undefined;
      },
    };
  },
  ofArray: <T>(resources: WPKResource<T>[]): WPKResource<T[]> => {
    return {
      update(device, queue, encoder) {
        return resources.map((resource) => resource.update(device, queue, encoder));
      },
      get() {
        return resources.map(resource => resource.get());
      },
      clean() {
        resources.forEach(resource => resource.clean());
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
      update(device, queue, encoder) {
        const currentDependencies = dependencyResources.map((dependencyResource) => dependencyResource.update(device, queue, encoder));
        if (!arrayFuncs.equals(lastDependencies, currentDependencies) || cachedValue === undefined) {
          cachedValue = createWithValues(device, queue, encoder, currentDependencies as any);
          lastDependencies = currentDependencies;
        }
        return cachedValue;
      },
      get() {
        return resourceFactory.getOrThrow(cachedValue, 'cached resource value');
      },
      clean() {
        dependencyResources.forEach(resource => resource.clean());
      },
    };
  },
  getOrThrow: <T>(t: T | undefined, name: string): T => {
    if (t === undefined) {
      throw Error(`Cannot get ${name} before update() is called`);
    }
    return t;
  },
};
