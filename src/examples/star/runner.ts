import { StarBufferFormats } from './buffer-formats';
import { Star, StarUniform } from './instance-formats';
import { camera, starPipelineDefinition, starPipelineOptions } from './pipeline-definition';
import { factories, setLogLevel, Transformation, WPKDisplayOptions } from '../..';
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
  const pipelineRunner = await factories.display.of(canvas);
  const debugOptions: WPKDebugOptions<StarUniform, Star, StarBufferFormats> = {
    async onBufferContents(contents) {
      logFuncs.lazyInfo(LOGGER, () => `Buffer contents: ${JSON.stringify(contents)}`);
    },
  };
  const starPipeline = factories.pipeline.ofDefinition(starPipelineDefinition, starPipelineOptions, debugOptions);
  pipelineRunner.add(starPipeline);
  const options: WPKDisplayOptions = {
    clear: Color.BLACK,
    isAntiAliased: true,
  };
  await pipelineRunner.display(options);
  while (true) {
    starPipeline.mutateUniform({ camera });
    const star: Star = {
      visual: {
        color: new Color(0.7, 0.8, 0.9),
        transformation: new Transformation(),
      },
    };
    LOGGER.debug('adding star');
    starPipeline.add(star);
    await pipelineRunner.display(options);
    await sleep(1_000);
  }
};

const sleep = (millis: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, millis));
};
