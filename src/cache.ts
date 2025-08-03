import { v4 as uuid } from 'uuid';

import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { BidiMap, CopySlice, Slice, sliceFuncs, ValueSlices } from './utils';

type WPKCacheMutable<T, TKey> = {
  mutate: (id: TKey, element: T) => void;
};
type WPKCacheResizeable<T> = {
  add: (element: T) => string;
  remove: (id: string) => void;
  indexOf: (id: string) => number;
};

export type WPKUniformCache<TUniformFormat extends WPKInstanceFormat, TMutable extends boolean> =
  & {
    isMutable: TMutable;
    isDirty: boolean;
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
    count: number;
    isDirty: boolean;
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

export const cacheFactory = {
  ofUniform: <
    TUniformFormat extends WPKInstanceFormat,
    TMutable extends boolean
  >(
    initialUniform: WPKInstanceOf<TUniformFormat>,
    mutable: TMutable,
  ): WPKUniformCache<TUniformFormat, TMutable> => {
    let previous: WPKInstanceOf<TUniformFormat> = initialUniform;
    let next: WPKInstanceOf<TUniformFormat> = initialUniform;
    const cache: WPKUniformCache<TUniformFormat, any> = {
      isMutable: mutable,
      isDirty: previous !== next,
      get() {
        previous = next;
        return next;
      },
    };
    if (mutable) {
      const typedCached = cache as WPKUniformCache<TUniformFormat, true>;
      typedCached.mutate = (uniform) => next = uniform;
    }
    return cache as WPKUniformCache<TUniformFormat, TMutable>;
  },
  ofEntitiesFixedSize: <
    TEntityFormat extends WPKInstanceFormat,
    TMutable extends boolean
  >(
    mutable: TMutable,
    ...elements: WPKInstanceOf<TEntityFormat>[]
  ): WPKEntityCache<TEntityFormat, TMutable, false> => {
    const mutated = new Map<number, WPKInstanceOf<TEntityFormat>>();
    elements.forEach((element, index) => mutated.set(index, element));
    const cache: WPKEntityCache<TEntityFormat, any, false> = {
      isMutable: mutable,
      isResizeable: false,
      count: elements.length,
      isDirty: mutated.size > 0,
      calculateChanges() {
        const slices = sliceFuncs.ofMap(mutated);
        mutated.clear();
        return slices;
      },
    };
    if (mutable) {
      const typedCache = cache as WPKEntityCache<TEntityFormat, true, false>;
      typedCache.mutate = mutated.set;
    }
    return cache as WPKEntityCache<TEntityFormat, TMutable, false>;
  },
  ofEntitiesResizeable: <
    TEntityFormat extends WPKInstanceFormat,
    TMutable extends boolean
  >(
    mutable: TMutable
  ): WPKEntityCache<TEntityFormat, TMutable, true> => {
    const idIndexes = new BidiMap<string, number>();
    const backing = new Map<string, WPKInstanceOf<TEntityFormat>>();
    const added = new Map<string, WPKInstanceOf<TEntityFormat>>();
    const mutated = new Map<string, WPKInstanceOf<TEntityFormat>>();
    const removed = new Set<string>();
    const cache: WPKEntityCache<TEntityFormat, any, true> = {
      isMutable: mutable,
      isResizeable: true,
      count: backing.size,
      isDirty: added.size > 0 || mutated.size > 0 || removed.size > 0,
      calculateChanges() {
        added.forEach((instance, id) => backing.set(id, instance));
        mutated.forEach((instance, id) => backing.set(id, instance));
        removed.forEach((id) => backing.delete(id));

        const stagingIdInstances = [
          ...added,
          ...mutated,
        ];
        const stagingIds = stagingIdInstances.map(([id]) => id);
        const stagingInstances = stagingIdInstances.map(([, instance]) => instance);
        const copySlices: CopySlice[] = [];

        const previousUsed = idIndexes.size;
        const newUsed = previousUsed + added.size - removed.size;

        // overwrite mutated or removed data
        const oldIds = [
          ...mutated.keys(),
          ...removed.keys(),
        ];
        const oldIndexes = oldIds.map((id) => idIndexes.get(id)).filter((index) => index !== undefined);
        oldIndexes.forEach((oldIndex) => idIndexes.deleteValue(oldIndex));
        const overwrittenIndexes = oldIndexes.filter((index) => index < newUsed);
        const overwrittenSlices = sliceFuncs.ofInts(overwrittenIndexes);
        let stagingIndexOffset = 0;
        for (const overwrittenSlice of overwrittenSlices) {
          const { min, length } = overwrittenSlice;
          const copySlice: Slice = {
            min: stagingIndexOffset,
            length,
          };
          copySlices.push({
            ...copySlice,
            toIndex: min,
          });
          for (let i = 0; i < length; i++) {
            const newIndex = min + i;
            const stagingIndex = stagingIndexOffset + i;
            const stagingId = stagingIds[stagingIndex];
            idIndexes.set(stagingId, newIndex, true);
          }
          stagingIndexOffset += length;
        }

        if (newUsed > previousUsed) {
          // append extra data
          const appendCount = newUsed - previousUsed;
          const appendSlice: Slice = {
            min: stagingIndexOffset,
            length,
          };
          copySlices.push({
            ...appendSlice,
            toIndex: previousUsed,
          });
          for (let i = 0; i < appendCount; i++) {
            const newIndex = previousUsed + i;
            const stagingIndex = stagingIndexOffset + i;
            const stagingId = stagingIds[stagingIndex];
            idIndexes.set(stagingId, newIndex, true);
          }
        } else if (newUsed < previousUsed) {
          // pull last instances down into slots vacated by removed items
          const replacedIndexes = oldIndexes.filter((index) => index >= newUsed);
          let movedIndex = previousUsed;
          for (const replacedIndex of replacedIndexes) {
            movedIndex--;
            while (movedIndex > newUsed && replacedIndexes.includes(movedIndex)) {
              movedIndex--;
            }
            if (movedIndex > replacedIndex) {
              const movedId = idIndexes.getKey(movedIndex);
              if (movedId !== undefined) {
                const movedSlice: Slice = {
                  min: movedIndex,
                  length: 1,
                };
                copySlices.push({
                  ...movedSlice,
                  toIndex: replacedIndex,
                });
                idIndexes.set(movedId, replacedIndex, true);
              }
            }
          }
        }
        const command = {
          values: stagingInstances,
          copySlices,
        };
        added.clear();
        removed.clear();
        mutated.clear();
        return command;
      },
      add(element) {
        const id = uuid();
        added.set(id, element);
        return id;
      },
      remove(id) {
        if (backing.has(id)) {
          added.delete(id);
          mutated.delete(id);
          removed.add(id);
        }
      },
      indexOf(id) {
        const index = idIndexes.get(id);
        return (index === undefined)
          ? -1
          : index;
      },
    };
    if (mutable) {
      const typedCache = cache as WPKEntityCache<TEntityFormat, true, true>;
      typedCache.mutate = (id, instance) => {
        if (!removed.has(id)) {
          if (backing.has(id)) {
            mutated.set(id, instance);
          } else if (added.has(id)) {
            added.set(id, instance);
          }
        }
      };
    }
    return cache as WPKEntityCache<TEntityFormat, TMutable, true>;
  },
};
