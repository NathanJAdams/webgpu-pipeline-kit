import { bufferFormats, StarBufferFormats } from './buffer-formats';
import { Star, StarUniform } from './instance-formats';
import { meshTemplates } from './mesh-templates';
import { renderShader } from './shader';
import { builders, Camera, factories, setLogLevel, Transformation, Vector3 } from '../..';
import { getLogger } from '../../logging';
import { WPKReadBackOptions, WPKPeripheralEventHandlers } from '../../types';
import { Color } from '../../utils';

const LOGGER = getLogger('pipeline');

export const run = async (): Promise<void> => {
  setLogLevel('TRACE');
  const canvas = document.getElementById('game-canvas') as (HTMLCanvasElement | null);
  if (canvas === null) {
    throw Error('Failed to get game canvas from document');
  }
  const camera = new Camera();
  const starPipelineOptions = builders.pipelineOptions<StarUniform, Star, true, true, true>()
    .mutableUniform(true)
    .mutableEntities(true)
    .resizeableEntities(true)
    .initialUniformObject().camera(camera).buildInitialUniform()
    .initialEntities([])
    .buildObject();
  const readBackOptions: WPKReadBackOptions<StarUniform, Star, StarBufferFormats> = {
    onReadBack(contents) {
      LOGGER.info(`Buffer contents: ${JSON.stringify(contents)}`);
    },
  };
  const starPipeline = factories.pipeline.ofRender('star', bufferFormats, meshTemplates, renderShader, starPipelineOptions, readBackOptions);
  const eventHandlers: WPKPeripheralEventHandlers = {
    'screen-resize': async (eventInfo) => {
      camera.setAspectRatio(eventInfo.aspectRatio);
      starPipeline.mutateUniform({ camera });
    },
  };
  const runner = await factories.pipelineRunner.ofRender(canvas, Color.BLACK, eventHandlers);
  runner.add(starPipeline);
  while (true) {
    LOGGER.debug('adding star');
    const star = newStar();
    starPipeline.add(star);
    await runner.step();
    await sleep(1_000);
  }
};

const newStar = (): Star => {
  const transformation = new Transformation();
  transformation.setPosition(new Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10));
  const scale = (Math.random() * 8) - 4;
  transformation.setScale(new Vector3(scale, scale, scale));
  return {
    visual: {
      color: new Color(Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5),
      transformation,
    },
  };
};

const sleep = (millis: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, millis));
};
