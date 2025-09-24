import { BufferFormats } from './buffer-formats';
import { Triangle, TriangleUniform } from './instance-formats';
import { trianglesPipelineDefinition, pipelineOptions } from './pipeline-definition';
import { factories, setLogLevel, WPKDisplayOptions } from '../..';
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
  window.addEventListener('resize', () => resizeCanvasToDisplaySize(canvas));
  resizeCanvasToDisplaySize(canvas);
  const pipelineRunner = await factories.display.of(canvas);
  const debugOptions: WPKDebugOptions<TriangleUniform, Triangle, BufferFormats> = {
    async onBufferContents(contents) {
      logFuncs.lazyInfo(LOGGER, () => `Buffer contents: ${JSON.stringify(contents)}`);
    },
  };
  const trianglePipeline = factories.pipeline.ofDefinition(trianglesPipelineDefinition, pipelineOptions, debugOptions);
  pipelineRunner.add(trianglePipeline);
  const options: WPKDisplayOptions = {
    clear: Color.BLACK,
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

const resizeCanvasToDisplaySize = (canvas: HTMLCanvasElement): void => {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
};
