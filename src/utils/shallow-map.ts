import { stringFuncs } from './string';

export class ShallowMap<K, V> {
  private readonly backing = new Map<string, V>();

  clear(): void {
    this.backing.clear();
  }
  delete(key: K): boolean {
    const keyString = stringFuncs.shallowStableStringify(key);
    return this.backing.delete(keyString);
  }
  get(key: K): V | undefined {
    const keyString = stringFuncs.shallowStableStringify(key);
    return this.backing.get(keyString);
  };
  has(key: K): boolean {
    const keyString = stringFuncs.shallowStableStringify(key);
    return this.backing.has(keyString);
  };
  set(key: K, value: V): void {
    const keyString = stringFuncs.shallowStableStringify(key);
    this.backing.set(keyString, value);
  };
  get size(): number {
    return this.backing.size;
  };
};
