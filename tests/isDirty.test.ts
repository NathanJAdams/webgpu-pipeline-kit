import { packedCacheFactory } from '../src/packed-cache';

type Example = {
};

const createCache = () => packedCacheFactory.of<Example, true>(true, []);

describe('isDirty', () => {
  test('adding makes it dirty until pack()', () => {
    const packedCache = createCache();
    expect(packedCache.isDirty()).toBe(false);
    packedCache.add({});
    expect(packedCache.isDirty()).toBe(true);
    packedCache.pack();
    expect(packedCache.isDirty()).toBe(false);
  });
  test('adding and removing does not make it dirty', () => {
    const packedCache = createCache();
    expect(packedCache.isDirty()).toBe(false);
    const id = packedCache.add({});
    expect(packedCache.isDirty()).toBe(true);
    packedCache.remove(id);
    expect(packedCache.isDirty()).toBe(false);
  });
  test('adding, mutating and removing does not make it dirty', () => {
    const packedCache = createCache();
    expect(packedCache.isDirty()).toBe(false);
    const id = packedCache.add({});
    expect(packedCache.isDirty()).toBe(true);
    packedCache.mutate(id, {});
    expect(packedCache.isDirty()).toBe(true);
    packedCache.remove(id);
    expect(packedCache.isDirty()).toBe(false);
  });
  test('removing makes it dirty until pack()', () => {
    const packedCache = createCache();
    const id = packedCache.add({});
    packedCache.pack();
    expect(packedCache.isDirty()).toBe(false);
    packedCache.remove(id);
    expect(packedCache.isDirty()).toBe(true);
    packedCache.pack();
    expect(packedCache.isDirty()).toBe(false);
  });
  test('removing non-existent does not make it dirty', () => {
    const packedCache = createCache();
    packedCache.add({});
    packedCache.pack();
    expect(packedCache.isDirty()).toBe(false);
    expect(() => packedCache.remove('non-existent')).toThrow();
    expect(packedCache.isDirty()).toBe(false);
  });
  test('mutating makes it dirty until pack()', () => {
    const packedCache = createCache();
    const id = packedCache.add({});
    packedCache.pack();
    expect(packedCache.isDirty()).toBe(false);
    packedCache.mutate(id, {});
    expect(packedCache.isDirty()).toBe(true);
    packedCache.pack();
    expect(packedCache.isDirty()).toBe(false);
  });
  test('mutating non-existent does not make it dirty', () => {
    const packedCache = createCache();
    packedCache.add({});
    packedCache.pack();
    expect(packedCache.isDirty()).toBe(false);
    expect(() => packedCache.mutate('non-existent', {})).toThrow();
    expect(packedCache.isDirty()).toBe(false);
  });
});
