import { OrbiterBufferFormats } from './buffer-formats';
import { Orbiter, OrbiterUniform } from './instance-formats';
import { camera, orbiterPipelineDefinition, orbiterPipelineOptions } from './pipeline-definition';
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
  const debugOptions: WPKDebugOptions<OrbiterUniform, Orbiter, OrbiterBufferFormats> = {
    async onBufferContents(contents) {
      logFuncs.lazyInfo(LOGGER, () => `Buffer contents: ${JSON.stringify(contents)}`);
    },
  };
  const orbiterPipeline = factories.pipeline.ofDefinition(orbiterPipelineDefinition, orbiterPipelineOptions, debugOptions);
  pipelineRunner.add(orbiterPipeline);
  const options: WPKDisplayOptions = {
    clear: Color.BLACK,
    isAntiAliased: true,
  };
  await pipelineRunner.display(options);
  let gameTime = 0;
  while (true) {
    gameTime++;
    orbiterPipeline.mutateUniform({ gameTime, camera });
    const orbiter: Orbiter = {
      kepler: {
        argumentOfPeriapsis: cosSin(Math.random()),
        eccentricity: 0.02,
        inclination: cosSin(Math.random()),
        longitudeOfAscendingNode: cosSin(Math.random()),
        meanAnomaly: 0.2,
        meanMotion: 1,
        primaryId: '',
        semiMajorAxis: 12,
        sqrt_OnePlusEccentricityOverOneMinusEccentricity: Math.sqrt((1 + 0.02) / (1 - 0.02)),
      },
      visual: {
        color: new Color(0.9, 0.9, 1.0),
        radius: 5,
      },
    };
    LOGGER.debug('adding orbiter');
    orbiterPipeline.add(orbiter);
    await pipelineRunner.display(options);
    await sleep(1_000);
  }
};

const cosSin = (number: number): [number, number] => [Math.cos(number), Math.sin(number)];

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
