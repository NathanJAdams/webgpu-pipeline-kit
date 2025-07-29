export const MapFuncs = {
  filter: <K, V>(map: Map<K, V>, predicate: (key: K, value: V) => boolean): Map<K, V> => {
    const filtered = new Map<K, V>();
    for (const [key, value] of map) {
      if (predicate(key, value)) {
        filtered.set(key, value);
      }
    }
    return filtered;
  },
  computeIfAbsent: <K, V>(map: Map<K, V>, key: K, compute: (key: K) => V): V => {
    let value = map.get(key);
    if (value === undefined) {
      value = compute(key);
      map.set(key, value);
    }
    return value;
  },
  convertMap: <K, V, T>(map: Map<K, V>, transform: (value: V, key: K) => T): Map<K, T> => {
    const converted = new Map<K, T>();
    for (const [key, value] of map) {
      const newValue = transform(value, key);
      converted.set(key, newValue);
    }
    return converted;
  },
  toArray: <K, V, T>(map: Map<K, V>, transform: (value: V, key: K) => T): T[] => {
    return Array.from(map.entries(), ([key, value]) => transform(value, key));
  },
  overwrite: <K, V>(inPlace: boolean, original: Map<K, V>, ...overwriters: Map<K, V>[]): Map<K, V> => {
    const newMap: Map<K, V> = inPlace ? original : new Map(original);
    overwriters.forEach((overwriter) => overwriter.forEach((value, key) => newMap.set(key, value)));
    return newMap;
  },
};
