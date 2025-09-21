import { describe, test } from 'vitest';
import { checkShaderCode } from '../../src/node/check';
import { trianglesPipelineDefinition } from '../../src/examples/triangles/pipeline-definition';
import { orbiterPipelineDefinition } from '../../src/examples/orbiter/pipeline-definition';
import { setLogLevel } from '../../src';

setLogLevel('INFO');

describe('check shader code', () => {
  test('valid shader code triangles', async () => {
    await checkShaderCode(trianglesPipelineDefinition);
  });
  test('valid shader code orbiters', async () => {
    await checkShaderCode(orbiterPipelineDefinition);
  });
});
