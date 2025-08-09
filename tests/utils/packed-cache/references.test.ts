import { describe, test, expect } from 'vitest';

import { packedCacheFactory } from '../../../src/utils';

type Example = {
};

const createCache = () => packedCacheFactory.of<Example, true>(true, []);

describe('references', () => {
  test('', () => { });
});
