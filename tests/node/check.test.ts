import { describe, test, expect } from 'vitest';

import { setLogLevel } from '../../src/logging';
import { getShaderCodeStageResult, toShaderCodeError } from '../../src/node/diagnostics';
import { checkShaderCodeStage } from '../../src/node/check';

setLogLevel('INFO');

describe('diagnostics', () => {
  test('can get shader code error', async () => {
    const error = await getShaderCodeStageResult('my code');
    expect(error).toBeDefined();
  });
  test('can check there is no shader code error', () => {
    // const error = checkShaderCodeStage('var<uniform> test : f32;');
    // expect(error).toBeDefined();
  });
});
