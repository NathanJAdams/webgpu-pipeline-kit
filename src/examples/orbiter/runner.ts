import { bufferFormats, OrbiterBufferFormats } from './buffer-formats';
import { Orbiter, OrbiterUniform } from './instance-formats';
import { meshTemplates } from './mesh-templates';
import { computeShader, renderShader } from './shader';
import { builders, Camera, factories, setLogLevel } from '../..';
import { getLogger } from '../../logging';
import { WPKReadBackOptions, WPKPeripheralEventHandlers } from '../../types';
import { Color } from '../../utils';

const LOGGER = getLogger('pipeline');

export const run = async (): Promise<void> => {
  setLogLevel('INFO');
  const canvas = document.getElementById('game-canvas') as (HTMLCanvasElement | null);
  if (canvas === null) {
    throw Error('Failed to get game canvas from document');
  }
  const camera = new Camera();
  const eventHandlers: WPKPeripheralEventHandlers = {
    'screen-resize': async (eventInfo) => camera.setAspectRatio(eventInfo.aspectRatio),
  };
  const pipelineRunner = await factories.pipelineRunner.ofComputeRender(canvas, Color.BLACK, eventHandlers);
  const orbiterPipelineOptions = builders.pipelineOptions<OrbiterUniform, Orbiter, true, true, true>()
    .mutableUniform(true)
    .mutableEntities(true)
    .resizeableEntities(true)
    .initialUniformObject().gameTime(0).camera(camera).buildInitialUniform()
    .initialEntities([])
    .buildObject();
  const readBackOptions: WPKReadBackOptions<OrbiterUniform, Orbiter, OrbiterBufferFormats> = {
    async onReadBack(contents) {
      LOGGER.info(`positions: ${JSON.stringify(contents.position)}`);
    },
  };
  const orbiterPipeline = factories.pipeline.ofComputeRender('orbiter', bufferFormats, meshTemplates, computeShader, renderShader, orbiterPipelineOptions, readBackOptions);
  pipelineRunner.add(orbiterPipeline);
  let gameTime = 0;
  while (true) {
    gameTime++;
    orbiterPipeline.mutateUniform({ gameTime, camera });
    const orbiter = newOrbiter();
    LOGGER.debug('adding orbiter');
    orbiterPipeline.add(orbiter);
    await pipelineRunner.step();
    await sleep(1_000);
  }
};

const newOrbiter = (): Orbiter => ({
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
});

const cosSin = (number: number): [number, number] => [Math.cos(number), Math.sin(number)];

const sleep = (millis: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, millis));
};
