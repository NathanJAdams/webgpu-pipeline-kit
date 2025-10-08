import { packedCacheFactory } from '../src/packed-cache';

type Example = {
};

describe('isMutable', () => {
  test('mutable', () => {
    const packedCache = packedCacheFactory.of<Example, true>(true, []);
    expect(packedCache.isMutable()).toBe(true);
    expect(packedCache['mutate']).toBeDefined();
  });
  test('immutable', () => {
    const packedCache = packedCacheFactory.of<Example, false>(false, []);
    expect(packedCache.isMutable()).toBe(false);
    //@ts-expect-error
    expect(packedCache['mutate']).not.toBeDefined();
  });
});
