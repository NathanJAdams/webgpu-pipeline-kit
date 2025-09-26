import { checkComputeShaderCode, checkRenderShaderCode } from '../../src/node/check';
import { setLogLevel } from '../../src';
import { renderShader as triangleRenderShader, computeShader as triangleComputeShader } from '../../src/examples/triangles/shader';
import { bufferFormats as triangleBufferFormats } from '../../src/examples/triangles/buffer-formats';
import { computeShader as orbiterComputeShader, renderShader as orbiterRenderShader } from '../../src/examples/orbiter/shader';
import { bufferFormats as orbiterBufferFormats } from '../../src/examples/orbiter/buffer-formats';
import { renderShader as starRenderShader } from '../../src/examples/star/shader';
import { bufferFormats as starBufferFormats } from '../../src/examples/star/buffer-formats';

setLogLevel('INFO');

describe('check shader code', () => {
  test('valid shader code orbiter', async () => {
    await checkComputeShaderCode(orbiterComputeShader, orbiterBufferFormats);
    await checkRenderShaderCode(orbiterRenderShader, orbiterBufferFormats);
  });
  test('valid shader code star', async () => {
    await checkRenderShaderCode(starRenderShader, starBufferFormats);
  });
  test('valid shader code triangles', async () => {
    await checkComputeShaderCode(triangleComputeShader, triangleBufferFormats);
    await checkRenderShaderCode(triangleRenderShader, triangleBufferFormats);
  });
});
