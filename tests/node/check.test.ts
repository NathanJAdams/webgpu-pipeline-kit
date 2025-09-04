import { describe, test, expect } from 'vitest';
import { getShaderCodeError } from '../../src/node/diagnostics';

describe('diagnostics', () => {
  test('can get shader code error', async () => {
    const error = await getShaderCodeError('my code');
    expect(error).toBeDefined();
  });
  test('can check there is no shader code error', async () => {
    const error = await getShaderCodeError('var<uniform> test : f32;');
    expect(error).toBeUndefined();
  });
});
