import { packedCacheFactory } from '../src/packed-cache';

type Example = {
};

const createCache = () => packedCacheFactory.of<Example, true>(true, []);

describe('count', () => {
  test('adding elements give correct count after pack()', () => {
    const packedCache = createCache();
    expect(packedCache.count()).toBe(0);
    packedCache.add({});
    expect(packedCache.count()).toBe(0);
    packedCache.add({});
    expect(packedCache.count()).toBe(0);
    packedCache.pack();
    expect(packedCache.count()).toBe(2);
  });
  test('removing elements give correct count after pack()', () => {
    const packedCache = createCache();
    const id0 = packedCache.add({});
    const id1 = packedCache.add({});
    const id2 = packedCache.add({});
    packedCache.pack();
    expect(packedCache.count()).toBe(3);
    packedCache.remove(id0);
    expect(packedCache.count()).toBe(3);
    packedCache.remove(id1);
    expect(packedCache.count()).toBe(3);
    packedCache.pack();
    expect(packedCache.count()).toBe(1);
    packedCache.remove(id2);
    expect(packedCache.count()).toBe(1);
    packedCache.pack();
    expect(packedCache.count()).toBe(0);
  });
  test('removing non-existent elements does not change count even after pack()', () => {
    const packedCache = createCache();
    packedCache.add({});
    packedCache.add({});
    packedCache.add({});
    packedCache.pack();
    expect(packedCache.count()).toBe(3);
    expect(() => packedCache.remove('non-existent')).toThrow();
    expect(packedCache.count()).toBe(3);
    packedCache.pack();
    expect(packedCache.count()).toBe(3);
  });
  test('mutating elements does not change count even after pack()', () => {
    const packedCache = createCache();
    const id0 = packedCache.add({});
    const id1 = packedCache.add({});
    const id2 = packedCache.add({});
    packedCache.pack();
    expect(packedCache.count()).toBe(3);
    packedCache.mutate(id0, {});
    expect(packedCache.count()).toBe(3);
    packedCache.mutate(id1, {});
    expect(packedCache.count()).toBe(3);
    packedCache.pack();
    expect(packedCache.count()).toBe(3);
    packedCache.mutate(id2, {});
    expect(packedCache.count()).toBe(3);
    packedCache.pack();
    expect(packedCache.count()).toBe(3);
  });
  test('mutating non-existent elements does not change count even after pack()', () => {
    const packedCache = createCache();
    packedCache.add({});
    packedCache.add({});
    packedCache.add({});
    packedCache.pack();
    expect(packedCache.count()).toBe(3);
    expect(() => packedCache.mutate('non-existent', {})).toThrow();
    expect(packedCache.count()).toBe(3);
    packedCache.pack();
    expect(packedCache.count()).toBe(3);
  });
});
