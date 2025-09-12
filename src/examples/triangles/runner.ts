import { factories, setLogLevel, WPKDisplayOptions } from '../..';
import { BufferFormats } from './buffer-formats';
import { Triangle, TriangleUniform } from './instance-formats';
import { pipelineDefinition, pipelineOptions } from './pipeline-definition';
import { logFactory } from '../../logging';
import { WPKDebugOptions } from '../../types';
import { logFuncs } from '../../utils';

const LOGGER = logFactory.getLogger('pipeline');

export const run = async (): Promise<void> => {
  setLogLevel('DEBUG');
  const canvas = document.getElementById('game-canvas') as (HTMLCanvasElement | null);
  if (canvas === null) {
    throw Error('Failed to get game canvas from document');
  }
  const pipelineRunner = await factories.display.of(canvas);
  const debugOptions: WPKDebugOptions<TriangleUniform, Triangle, BufferFormats> = {
    async onBufferContents(contents) {
      logFuncs.lazyInfo(LOGGER, () => `Buffer contents: ${JSON.stringify(contents)}`);
    },
  };
  const trianglePipeline = factories.pipeline.ofDefinition(pipelineDefinition, pipelineOptions, debugOptions);
  pipelineRunner.add(trianglePipeline);
  const options: WPKDisplayOptions = {
    clear: factories.color.BLACK,
    isAntiAliased: true,
  };
  await pipelineRunner.display(options);
  let gameTime = 0;
  while (true) {
    gameTime++;
    trianglePipeline.mutateUniform({ gameTime });
    const triangle: Triangle = {
      x: 1,
      y: 2,
      z: 3,
    };
    LOGGER.debug('adding triangle');
    trianglePipeline.add(triangle);
    await pipelineRunner.display(options);
    await sleep(1_000);
  }
};

const sleep = (millis: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, millis));
};
