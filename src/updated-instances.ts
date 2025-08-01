import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { WPKInstanceCommand } from './InstanceCache';
import { BidiMap, CopySlice, Slice, sliceFuncs, ValueSlices } from './utils';

export const updatedInstancesFuncs = {
  byIndex: <TFormat extends WPKInstanceFormat>(
    indexedInstances: Map<number, WPKInstanceOf<TFormat>>
  ): ValueSlices<WPKInstanceOf<TFormat>[]> => sliceFuncs.ofMap(indexedInstances),
  byIdIndex: <TFormat extends WPKInstanceFormat>(
    idIndexes: BidiMap<string, number>,
    command: WPKInstanceCommand<WPKInstanceOf<TFormat>>
  ): ValueSlices<WPKInstanceOf<TFormat>[]> => {
    const { added, mutated, removed } = command;
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
    return {
      values: stagingInstances,
      copySlices,
    };
  },
};
