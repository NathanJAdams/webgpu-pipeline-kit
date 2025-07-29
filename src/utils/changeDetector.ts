export type ChangeDetector<T> = {
    get: () => T;
    compareAndUpdate: (next: T) => boolean;
};

export const ChangeDetectors = {
  of: <T>(first: T, equals: (a: T, b: T) => boolean): ChangeDetector<T> => {
    let current: T = first;
    return {
      get() {
        return current;
      },
      compareAndUpdate(next) {
        const hasChanged = (current === undefined) || !equals(current, next);
        current = next;
        return hasChanged;
      },
    };
  },
  ofDoubleEquals: <T>(first: T): ChangeDetector<T> => {
    return ChangeDetectors.of<T>(first, (a, b) => a == b);
  },
  ofTripleEquals: <T>(first: T): ChangeDetector<T> => {
    return ChangeDetectors.of<T>(first, (a, b) => a === b);
  },
};
