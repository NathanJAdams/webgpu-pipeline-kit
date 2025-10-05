import { bufferFormats, BufferFormats } from './buffer-formats';
import { Triangle, TriangleUniform } from './instance-formats';
import { meshTemplates } from './mesh-templates';
import { computeShader, renderShader } from './shader';
import { builders, factories, setLogLevel } from '../..';
import { getLogger } from '../../logging';
import { WPKReadBackOptions, WPKPeripheralEventHandlers } from '../../types';
import { Color } from '../../utils';

const LOGGER = getLogger('pipeline');

export const run = async (): Promise<void> => {
  setLogLevel('DEBUG');
  setLogLevel('TRACE', 'pipeline');
  const canvas = document.getElementById('game-canvas') as (HTMLCanvasElement | null);
  if (canvas === null) {
    throw Error('Failed to get game canvas from document');
  }
  const eventHandlers: WPKPeripheralEventHandlers = {};
  const pipelineRunner = await factories.pipelineRunner.ofComputeRender(canvas, Color.BLACK, eventHandlers);
  const pipelineOptions = builders.pipelineOptions<TriangleUniform, Triangle, true, true, true>()
    .mutableUniform(true)
    .mutableEntities(true)
    .resizeableEntities(true)
    .initialUniformObject().gameTime(0).buildInitialUniform()
    .initialEntities([])
    .buildObject();
  const readBackOptions: WPKReadBackOptions<TriangleUniform, Triangle, BufferFormats> = {
    onReadBack(contents) {
      LOGGER.info(`Buffer contents dispatch: ${JSON.stringify(contents.dispatch)}`);
      LOGGER.info(`Buffer contents offsets: ${JSON.stringify(contents.offsets)}`);
      LOGGER.info(`Buffer contents uniforms: ${JSON.stringify(contents.uniforms)}`);
    },
  };
  const trianglePipeline = factories.pipeline.ofComputeRender('triangles', bufferFormats, meshTemplates, computeShader, renderShader, pipelineOptions, readBackOptions);
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
    await sleep(5_000);
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
