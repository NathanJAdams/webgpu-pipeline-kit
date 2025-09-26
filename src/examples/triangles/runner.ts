import { bufferFormats, BufferFormats } from './buffer-formats';
import { Triangle, TriangleUniform } from './instance-formats';
import { meshTemplates } from './mesh-templates';
import { computeShader, renderShader } from './shader';
import { builders, factories, setLogLevel } from '../..';
import { logFactory } from '../../logging';
import { WPKDebugOptions } from '../../types';
import { Color, logFuncs } from '../../utils';

const LOGGER = logFactory.getLogger('pipeline');

export const run = async (): Promise<void> => {
  setLogLevel('TRACE');
  const canvas = document.getElementById('game-canvas') as (HTMLCanvasElement | null);
  if (canvas === null) {
    throw Error('Failed to get game canvas from document');
  }
  const pipelineRunner = await factories.pipelineRunner.ofComputeRender(canvas, Color.BLACK, async (_aspectRatio) => { });
  const pipelineOptions = builders.pipelineOptions<TriangleUniform, Triangle, true, true, true>()
    .mutableUniform(true)
    .mutableEntities(true)
    .resizeableEntities(true)
    .initialUniformObject().gameTime(0).buildInitialUniform()
    .initialEntities([])
    .buildObject();
  const debugOptions: WPKDebugOptions<TriangleUniform, Triangle, BufferFormats> = {
    async onBufferContents(contents) {
      logFuncs.lazyInfo(LOGGER, () => `Buffer contents: ${JSON.stringify(contents)}`);
    },
  };
  const trianglePipeline = factories.pipeline.ofComputeRender('triangles', bufferFormats, meshTemplates, computeShader, renderShader, pipelineOptions, debugOptions);
  pipelineRunner.add(trianglePipeline);
  await pipelineRunner.step();
  let gameTime = 0;
  while (true) {
    gameTime++;
    trianglePipeline.mutateUniform({ gameTime });
    const triangle = newTriangle();
    LOGGER.debug('adding triangle');
    trianglePipeline.add(triangle);
    await pipelineRunner.step();
    await sleep(1_000);
  }
};

const newTriangle = (): Triangle => ({
  x: 1,
  y: 2,
  z: 3,
});

const sleep = (millis: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, millis));
};
