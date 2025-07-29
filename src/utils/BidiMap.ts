export class BidiMap<K, V> {
  private readonly keyValues = new Map<K, V>();
  private readonly valueKeys = new Map<V, K>();

  get size(): number {
    return this.keyValues.size;
  }
  clear(): void {
    this.keyValues.clear();
    this.valueKeys.clear();
  }
  entries(): MapIterator<[K, V]> {
    return this.keyValues.entries();
  }
  forEach(callbackFn: (value: V, key: K, bidiMap: BidiMap<K, V>) => void): void {
    for (const [key, value] of this.keyValues) {
      callbackFn(value, key, this);
    }
  }
  delete(key: K): boolean {
    const hasKey = this.keyValues.has(key);
    if (hasKey) {
      const value = this.keyValues.get(key);
      this.keyValues.delete(key);
      if (value !== undefined) {
        this.valueKeys.delete(value);
      }
    }
    return hasKey;
  }
  deleteValue(value: V): boolean {
    const hasValue = this.valueKeys.has(value);
    if (hasValue) {
      const key = this.valueKeys.get(value);
      this.valueKeys.delete(value);
      if (key !== undefined) {
        this.keyValues.delete(key);
      }
    }
    return hasValue;
  }
  get(key: K): V | undefined {
    return this.keyValues.get(key);
  }
  getKey(value: V): K | undefined {
    return this.valueKeys.get(value);
  }
  set(key: K, value: V, removeDuplicateValue: boolean): BidiMap<K, V> {
    if (removeDuplicateValue || !this.valueKeys.has(value)) {
      this.keyValues.set(key, value);
      this.valueKeys.set(value, key);
    }
    return this;
  }
  has(key: K): boolean {
    return this.keyValues.has(key);
  }
  hasValue(value: V): boolean {
    return this.valueKeys.has(value);
  }
  keys(): MapIterator<K> {
    return this.keyValues.keys();
  }
  values(): MapIterator<V> {
    return this.valueKeys.keys();
  }
}
