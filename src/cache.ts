import { WPKDatumExtractor } from './datum-extractor';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { logFactory } from './logging';
import { logFuncs, sliceFuncs, ValueSlices } from './utils';
import { PackedCache, packedCacheFactory } from './utils/packed-cache';

type WPKCacheMutable<T, TKey> = {
  mutate: (id: TKey, element: T) => void;
};
export type WPKCacheResizeable<T> = {
  add: (element: T) => string;
  remove: (id: string) => void;
  indexOf: (id: string) => number;
};

export type WPKUniformCache<TUniformFormat extends WPKInstanceFormat, TMutable extends boolean> =
  & {
    isMutable: TMutable;
    isDirty: () => boolean;
    get: () => WPKInstanceOf<TUniformFormat>;
  }
  & (
    TMutable extends true
    ? {
      mutate: (element: WPKInstanceOf<TUniformFormat>) => void;
    }
    : object
  );

export type WPKEntityCache<TEntityFormat extends WPKInstanceFormat, TMutable extends boolean, TResizeable extends boolean> =
  & {
    isMutable: TMutable;
    isResizeable: TResizeable;
    count: () => number;
    isDirty: () => boolean;
    calculateChanges: () => ValueSlices<WPKInstanceOf<TEntityFormat>[]>;
  }
  & (TMutable extends true
    ? WPKCacheMutable<WPKInstanceOf<TEntityFormat>, TResizeable extends true ? string : number>
    : object
  )
  & (
    TResizeable extends true
    ? WPKCacheResizeable<WPKInstanceOf<TEntityFormat>>
    : object
  );

const LOGGER = logFactory.getLogger('cache');

export const cacheFactory = {
  ofUniform: <TUniformFormat extends WPKInstanceFormat, TMutable extends boolean>(
    _uniformFormat: TUniformFormat,
    mutable: TMutable,
    initialUniform: WPKInstanceOf<TUniformFormat>,
  ): WPKUniformCache<TUniformFormat, TMutable> => {
    logFuncs.lazyDebug(LOGGER, () => `Creating uniform cache from format ${JSON.stringify(_uniformFormat)}`);
    let previous: WPKInstanceOf<TUniformFormat> = initialUniform;
    let next: WPKInstanceOf<TUniformFormat> = initialUniform;
    const cache: WPKUniformCache<TUniformFormat, any> = {
      isMutable: mutable,
      isDirty: () => previous !== next,
      get() {
        previous = next;
        return next;
      },
    };
    if (mutable) {
      logFuncs.lazyTrace(LOGGER, () => 'Making uniform cache mutable');
      const typedCached = cache as WPKUniformCache<TUniformFormat, true>;
      typedCached.mutate = (uniform) => next = uniform;
    }
    return cache as WPKUniformCache<TUniformFormat, TMutable>;
  },
  ofEntitiesFixedSize: <TEntityFormat extends WPKInstanceFormat, TMutable extends boolean>(
    _entityFormat: TEntityFormat,
    mutable: TMutable,
    ...initialEntities: WPKInstanceOf<TEntityFormat>[]
  ): WPKEntityCache<TEntityFormat, TMutable, false> => {
    logFuncs.lazyDebug(LOGGER, () => `Creating fixed size entity cache from format ${JSON.stringify(_entityFormat)}`);
    const mutated = new Map<number, WPKInstanceOf<TEntityFormat>>();
    initialEntities.forEach((element, index) => mutated.set(index, element));
    const cache: WPKEntityCache<TEntityFormat, any, false> = {
      isMutable: mutable,
      isResizeable: false,
      count: () => initialEntities.length,
      isDirty: () => mutated.size > 0,
      calculateChanges() {
        const slices = sliceFuncs.ofMap(mutated, (entity, index) => index, entity => entity);
        mutated.clear();
        logFuncs.lazyTrace(LOGGER, () => `Calculated entity cache changes ${JSON.stringify(slices)}`);
        return slices;
      },
    };
    if (mutable) {
      logFuncs.lazyTrace(LOGGER, () => 'Making entity cache mutable');
      const typedCache = cache as WPKEntityCache<TEntityFormat, true, false>;
      typedCache.mutate = (index, instance) => {
        logFuncs.lazyTrace(LOGGER, () => `Mutating instance with index ${index}`);
        mutated.set(index, instance);
      };
    }
    return cache as WPKEntityCache<TEntityFormat, TMutable, false>;
  },
  ofEntitiesResizeable: <TEntityFormat extends WPKInstanceFormat, TMutable extends boolean>(
    entityFormat: TEntityFormat,
    mutable: TMutable,
    entityIdExtractors: WPKDatumExtractor<TEntityFormat, string>[],
  ): WPKEntityCache<TEntityFormat, TMutable, true> => {
    logFuncs.lazyDebug(LOGGER, () => `Creating resizeable entity cache from format ${JSON.stringify(entityFormat)}`);
    const packedCache = packedCacheFactory.of<WPKInstanceOf<TEntityFormat>, TMutable>(mutable, entityIdExtractors);
    const entityCache: WPKEntityCache<TEntityFormat, any, any> = {
      isMutable() {
        return mutable;
      },
      isResizeable() {
        return true;
      },
      isDirty() {
        return packedCache.isDirty();
      },
      count() {
        return packedCache.count();
      },
      add(instance) {
        return packedCache.add(instance);
      },
      remove(id) {
        return packedCache.remove(id);
      },
      indexOf(id) {
        return packedCache.indexOf(id);
      },
      calculateChanges() {
        return packedCache.pack();
      },
    };
    if (mutable) {
      const typedPackedCache = (packedCache as PackedCache<WPKInstanceOf<TEntityFormat>, true>);
      (entityCache as WPKEntityCache<TEntityFormat, true, true>).mutate = (id, instance) => {
        typedPackedCache.mutate(id, instance);
      };
    }
    return entityCache as WPKEntityCache<TEntityFormat, TMutable, true>;
  },
};
