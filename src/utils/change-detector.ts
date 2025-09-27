import { Equality } from './compare';

export type WPKChangeDetector<T> = {
    get: () => T;
    compareAndUpdate: (next: T) => boolean;
};

export const changeDetectorFactory = {
  of: <T>(first: T, equals: Equality<T>): WPKChangeDetector<T> => {
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
  ofDoubleEquals: <T>(first: T): WPKChangeDetector<T> => {
    return changeDetectorFactory.of<T>(first, (a, b) => a == b);
  },
  ofTripleEquals: <T>(first: T): WPKChangeDetector<T> => {
    return changeDetectorFactory.of<T>(first, (a, b) => a === b);
  },
};
