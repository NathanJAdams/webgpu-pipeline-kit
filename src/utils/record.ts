export const RecordFuncs = {
  filter: <K extends string | number | symbol, V>(record: Record<K, V>, predicate: (value: V, key: K) => boolean): Record<K, V> => {
    return Object.fromEntries(
      Object.entries(record).filter(([key, value]) =>
        predicate(value as V, key as K)
      )
    ) as Record<K, V>;
  },
  forEach: <K extends string | number | symbol, V>(record: Record<K, V>, apply: (value: V, key: K) => void): void => {
    Object.entries(record).map(([key, value]) => [key, apply(value as V, key as K)]);
  },
  mapRecord: <K extends string | number | symbol, V, T>(record: Record<K, V>, transform: (value: V, key: K) => T): Record<K, T> => {
    return Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, transform(value as V, key as K)])
    ) as Record<K, T>;
  },
  toMap: <K extends string | number | symbol, V, T>(record: Record<K, V>, transform: (value: V, key: K) => T): Map<K, T> => {
    return new Map<K, T>(Object.entries(record).map(([key, value]) => [key as K, transform(value as V, key as K)]));
  },
  toArray: <K extends string | number | symbol, V, T>(record: Record<K, V>, transform: (value: V, key: K) => T): T[] => {
    return Object.entries(record).map(([key, value]) => transform(value as V, key as K));
  },
};
