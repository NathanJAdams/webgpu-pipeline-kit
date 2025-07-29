import { Comparators, Equality } from './compare';
import { Random } from './random';

export const ArrayFuncs = {
  equals: <T>(a: T[], b: T[], equality: Equality<T> = Comparators.ofTripleEquals()) => {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((val, i) => equality(val, b[i]));
  },
  shuffle: <T>(array: T[], random: Random): T[] => {
    const shuffled = [...array];
    // last to first ensures fairness while keeping it simple
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = random.intMinMax(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },
  merge: <T>(...arrays: (T[] | undefined | null)[]): T[] => arrays.flatMap(arr => arr ?? []),
  toRecord: <T, K extends string | number | symbol, V>(array: T[], toKey: (element: T) => K, toValue: (element: T) => V): Record<K, V> => {
    return array.reduce((acc, element) => {
      const key = toKey(element);
      const value = toValue(element);
      acc[key] = value;
      return acc;
    }, {} as Record<K, V>);
  },
  toMap: <T, K, V>(array: T[], toKey: (element: T, index: number) => K, toValue: (element: T, index: number) => V): Map<K, V> => {
    return array.reduce((acc, element, index) => {
      const key = toKey(element, index);
      const value = toValue(element, index);
      acc.set(key, value);
      return acc;
    }, new Map<K, V>());
  },
};
