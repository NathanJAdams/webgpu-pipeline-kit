import { describe, test, expect } from 'vitest';

import { packedCacheFactory } from '../../../src/utils';

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
    expect(packedCache['mutate']).not.toBeDefined();
  });
});
