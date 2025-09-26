import { bufferFormats, StarBufferFormats } from './buffer-formats';
import { Star, StarUniform } from './instance-formats';
import { meshTemplates } from './mesh-templates';
import { renderShader } from './shader';
import { builders, Camera, factories, setLogLevel, Transformation, Vector3 } from '../..';
import { logFactory } from '../../logging';
import { WPKDebugOptions } from '../../types';
import { changeDetectorFactory, Color, logFuncs } from '../../utils';

const LOGGER = logFactory.getLogger('pipeline');

export const run = async (): Promise<void> => {
  setLogLevel('TRACE');
  const canvas = document.getElementById('game-canvas') as (HTMLCanvasElement | null);
  if (canvas === null) {
    throw Error('Failed to get game canvas from document');
  }
  const camera = new Camera(true);
  const aspectRatioChangeDetector = changeDetectorFactory.ofTripleEquals(1);
  let hasResized = true;
  const runner = await factories.pipelineRunner.ofRender(canvas, Color.BLACK, async (aspectRatio) => hasResized = aspectRatioChangeDetector.compareAndUpdate(aspectRatio));
  const starPipelineOptions = builders.pipelineOptions<StarUniform, Star, true, true, true>()
    .mutableUniform(true)
    .mutableEntities(true)
    .resizeableEntities(true)
    .initialUniformObject().camera(camera).buildInitialUniform()
    .initialEntities([])
    .buildObject();
  const debugOptions: WPKDebugOptions<StarUniform, Star, StarBufferFormats> = {
    async onBufferContents(contents) {
      logFuncs.lazyInfo(LOGGER, () => `Buffer contents: ${JSON.stringify(contents)}`);
    },
  };
  const starPipeline = factories.pipeline.ofRender('star', bufferFormats, meshTemplates, renderShader, starPipelineOptions, debugOptions);
  runner.add(starPipeline);
  camera.setPosition(new Vector3(0, 0, 0));
  while (true) {
    LOGGER.debug('adding star');
    const star = newStar();
    starPipeline.add(star);
    if (hasResized) {
      camera.setAspectRatio(aspectRatioChangeDetector.get());
      starPipeline.mutateUniform({ camera });
      hasResized = false;
    }
    await runner.step();
    await sleep(1_000);
  }
};

const newStar = (): Star => {
  const transformation = new Transformation();
  transformation.setPosition(new Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10));
  const scale = Math.random() * 8 - 4;
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
