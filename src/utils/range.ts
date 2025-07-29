export type Range = {
  min: number;
  max: number;
};

export const Range = {
  toRanges: (nums: number[]): Range[] => {
    const ranges: Range[] = [];
    if (nums.length === 0) {
      return ranges;
    }
    const sorted = nums.toSorted((a, b) => a - b);
    let min = sorted[0];
    let max = min;
    for (let i = 1; i < sorted.length; i++) {
      const num = sorted[i];
      if (num === max || num === max + 1) {
        max = num;
      } else {
        ranges.push({ min, max });
        min = max = num;
      }
    }
    ranges.push({ min, max });
    return ranges;
  },
};
