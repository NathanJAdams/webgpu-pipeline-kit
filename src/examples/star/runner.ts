import { StarBufferFormats } from './buffer-formats';
import { Star, StarUniform } from './instance-formats';
import { camera, starPipelineDefinition, starPipelineOptions } from './pipeline-definition';
import { Camera, factories, setLogLevel, Transformation, Vector3, WPKDisplayOptions } from '../..';
import { logFactory } from '../../logging';
import { WPKDebugOptions, WPKDisplay, WPKPipeline } from '../../types';
import { Color, logFuncs } from '../../utils';

const LOGGER = logFactory.getLogger('pipeline');

export const run = async (): Promise<void> => {
  setLogLevel('TRACE');
  const canvas = document.getElementById('game-canvas') as (HTMLCanvasElement | null);
  if (canvas === null) {
    throw Error('Failed to get game canvas from document');
  }
  const display = await factories.display.of(canvas);
  const debugOptions: WPKDebugOptions<StarUniform, Star, StarBufferFormats> = {
    async onBufferContents(contents) {
      logFuncs.lazyInfo(LOGGER, () => `Buffer contents: ${JSON.stringify(contents)}`);
    },
  };
  const starPipeline = factories.pipeline.ofDefinition(starPipelineDefinition, starPipelineOptions, debugOptions);
  display.add(starPipeline);
  camera.setPosition(new Vector3(0, 0, 0));
  const redisplayer = createRedisplayer(canvas, camera, starPipeline, display);
  window.addEventListener('resize', async () => await resizeCanvasToDisplaySize(canvas, redisplayer));
  // TODO abstract out canvas resizer/redisplayer => fps displayer
  await resizeCanvasToDisplaySize(canvas, redisplayer);
  while (true) {
    const transformation = new Transformation();
    transformation.setPosition(new Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10));
    const scale = Math.random() * 8 - 4;
    transformation.setScale(new Vector3(scale, scale, scale));
    const star: Star = {
      visual: {
        color: new Color(Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5),
        transformation,
      },
    };
    LOGGER.debug('adding star');
    starPipeline.add(star);
    await redisplayer();
    await sleep(1_000);
  }
};

const sleep = (millis: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, millis));
};

const resizeCanvasToDisplaySize = async (canvas: HTMLCanvasElement, redisplayer: Redisplayer): Promise<void> => {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    await redisplayer();
  }
};

type Redisplayer = () => Promise<void>;

const createRedisplayer = (canvas: HTMLCanvasElement, camera: Camera, pipeline: WPKPipeline<StarUniform, Star, true, true, true>, display: WPKDisplay): Redisplayer => {
  const options: WPKDisplayOptions = {
    clear: Color.BLACK,
    isAntiAliased: true,
  };
  let aspectRatio = canvas.width / canvas.height;
  camera.setAspectRatio(aspectRatio);
  pipeline.mutateUniform({ camera });
  return async (): Promise<void> => {
    let newAspectRatio = canvas.width / canvas.height;
    if (newAspectRatio !== aspectRatio) {
      camera.setAspectRatio(canvas.width / canvas.height);
      pipeline.mutateUniform({ camera });
    }
    LOGGER.debug('redisplaying');
    await display.display(options);
  };
};
