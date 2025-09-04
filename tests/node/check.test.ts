import { describe, test, expect } from 'vitest';
import { checkShaderCode } from '../../src/node/check';
import { pipelineDefinition } from '../../src/example/triangle';
import { setLogLevel } from '../../src';

setLogLevel('INFO');

describe('diagnostics', () => {
  test('can get shader code error', async () => {
    await checkShaderCode(pipelineDefinition);
  });
});
