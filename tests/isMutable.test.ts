import { describe, test, expect } from 'vitest';

import { setLogLevel } from '../src/logging';
import { packedCacheFactory } from '../src/packed-cache';

type Example = {
};

setLogLevel('WARN');

describe.skip('isMutable', () => {
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
