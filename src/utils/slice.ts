export type Indexed<T> = readonly [number, T];

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

export const sliceFuncs = {
  ofArray: <T, S>(array: T[], toIndexFunc: (element: T) => number, toSlicedValueFunc: (element: T) => S): ValueSlices<S[]> => {
    const indexed = array.map(element => [toIndexFunc(element), toSlicedValueFunc(element)] as const);
    return sliceFuncs.ofIndexed(indexed);
  },
  ofMap: <K, V, T>(map: Map<K, V>, toIndexFunc: (value: V, key: K) => number, toSlicedValueFunc: (value: V, key: K) => T): ValueSlices<T[]> => {
    const indexed = Array.from(map.entries(), ([key, value]) => [toIndexFunc(value, key), toSlicedValueFunc(value, key)] as const);
    return sliceFuncs.ofIndexed(indexed);
  },
  ofSet: <T, S>(set: Set<T>, toIndexFunc: (element: T) => number, toSlicedValueFunc: (element: T) => S): ValueSlices<S[]> => {
    const indexed = Array.from(set.values()).map(element => [toIndexFunc(element), toSlicedValueFunc(element)] as const);
    return sliceFuncs.ofIndexed(indexed);
  },
  ofIndexed: <T>(indexed: Indexed<T>[]): ValueSlices<T[]> => {
    const sorted = indexed.sort(([indexA], [indexB]) => indexA - indexB);
    const values = sorted.map(([, value]) => value);
    const indexes = sorted.map(([index]) => index);
    const slices = sliceFuncs.ofInts(indexes);
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
  ofInts: (nums: number[]): Slice[] => {
    const slices: Slice[] = [];
    if (nums.length === 0) {
      return slices;
    }
    const sorted = nums.sort((a, b) => a - b);
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
};
