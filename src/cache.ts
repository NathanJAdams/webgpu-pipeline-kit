import { logFactory } from './logging';
import { packedCacheFactory } from './packed-cache';
import { PackedCache, WPKCacheResizeable, WPKDatumExtractor, WPKEntityCache, WPKUniformCache } from './types';
import { logFuncs, sliceFuncs } from './utils';

const LOGGER = logFactory.getLogger('cache');

export const cacheFactory = {
  ofUniform: <TUniform, TMutable extends boolean>(
    mutable: TMutable,
    initialUniform: TUniform,
  ): WPKUniformCache<TUniform, TMutable> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating uniform cache');
    let _uniform: TUniform = initialUniform;
    let _isDirty: boolean = true;
    const cache: WPKUniformCache<TUniform, any> = {
      isMutable: mutable,
      isDirty: () => _isDirty,
      get() {
        _isDirty = false;
        return _uniform;
      },
    };
    if (mutable) {
      logFuncs.lazyTrace(LOGGER, () => 'Making uniform cache mutable');
      const typedCached = cache as WPKUniformCache<TUniform, true>;
      typedCached.mutate = (uniform) => {
        _uniform = uniform;
        _isDirty = true;
      };
    }
    return cache as WPKUniformCache<TUniform, TMutable>;
  },
  ofEntitiesFixedSize: <TEntity, TMutable extends boolean>(
    mutable: TMutable,
    ...initialEntities: TEntity[]
  ): WPKEntityCache<TEntity, TMutable, false> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating fixed size entity cache');
    const mutated = new Map<number, TEntity>();
    initialEntities.forEach((element, index) => mutated.set(index, element));
    const cache: WPKEntityCache<TEntity, any, false> = {
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
      const typedCache = cache as WPKEntityCache<TEntity, true, false>;
      typedCache.mutate = (index, instance) => {
        logFuncs.lazyTrace(LOGGER, () => `Mutating instance with index ${index}`);
        mutated.set(index, instance);
      };
    }
    return cache as WPKEntityCache<TEntity, TMutable, false>;
  },
  ofEntitiesResizeable: <T, TMutable extends boolean>(
    mutable: TMutable,
    entityIdExtractors: WPKDatumExtractor<T, string>[],
  ): WPKEntityCache<T, TMutable, true> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating resizeable entity cache');
    const packedCache = packedCacheFactory.of<T, TMutable>(mutable, entityIdExtractors);
    const entityCache: WPKCacheResizeable<T> & WPKEntityCache<T, any, any> = {
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
      idOf(index) {
        return packedCache.idOf(index);
      },
      indexOf(id) {
        return packedCache.indexOf(id);
      },
      calculateChanges() {
        return packedCache.pack();
      },
    };
    if (mutable) {
      const typedPackedCache = (packedCache as PackedCache<T, true>);
      (entityCache as WPKEntityCache<T, true, true>).mutate = (id, instance) => {
        typedPackedCache.mutate(id, instance);
      };
    }
    return entityCache as WPKEntityCache<T, TMutable, true>;
  },
};
