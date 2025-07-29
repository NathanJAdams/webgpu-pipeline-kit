export type Slice = {
    min: number;
    length: number;
};
export type CopySlice = Slice & {
    toIndex: number;
};
export type ValueSlices<T> = {
    values: T;
    copySlices: CopySlice[];
};

export const Slices = {
  ofInts: (nums: number[]): Slice[] => {
    const slices: Slice[] = [];
    if (nums.length === 0) {
      return slices;
    }
    const sorted = nums.toSorted((a, b) => a - b);
    let min = sorted[0];
    let max = min;
    for (let i = 1; i < sorted.length; i++) {
      const num = sorted[i];
      if (!Number.isInteger(num)) {
        throw Error(`Cannot create slices with non-integer number ${num}`);
      }
      if (num === max || num === max + 1) {
        max = num;
      } else {
        slices.push({ min, length: max + 1 - min });
        min = max = num;
      }
    }
    slices.push({ min, length: max + 1 - min });
    return slices;
  },
  ofMap: <V>(map: Map<number, V>): ValueSlices<V[]> => {
    const sortedEntries = map.entries().toArray().sort(([indexA], [indexB]) => indexA - indexB);
    const values = sortedEntries.map(([, value]) => value);
    const indexes = sortedEntries.map(([index]) => index);
    const slices = Slices.ofInts(indexes);
    const copySlices = Array.from<CopySlice>({ length: slices.length });
    let fromIndex = 0;
    for (const [sliceIndex, slice] of slices.entries()) {
      const { length, min } = slice;
      copySlices[sliceIndex] = {
        min: fromIndex,
        length: length,
        toIndex: min,
      };
      fromIndex += length;
    }
    return {
      copySlices,
      values,
    };
  },
};
