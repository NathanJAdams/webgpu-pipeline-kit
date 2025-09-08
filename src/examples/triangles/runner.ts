import { factories, setLogLevel, WPKDisplayOptions } from '../..';
import { Triangle } from './instance-formats';
import { pipelineDefinition, pipelineOptions } from './pipeline-definition';

export const run = async (): Promise<void> => {
  setLogLevel('INFO');
  setLogLevel('DEBUG', 'shader');
  const canvas = document.getElementById('game-canvas') as (HTMLCanvasElement | null);
  if (canvas === null) {
    throw Error('Failed to get game canvas from document');
  }
  const pipelineRunner = await factories.display.of(canvas);
  const trianglePipeline = factories.pipeline.ofDefinition(pipelineDefinition, pipelineOptions);
  pipelineRunner.add(trianglePipeline);
  const options: WPKDisplayOptions = {
    clear: factories.color.BLACK,
    isAntiAliased: true,
  };
  await pipelineRunner.display(options);
  while (true) {
    const triangle: Triangle = {
      x: 1,
      y: 2,
      z: 3,
    };
    trianglePipeline.add(triangle);
    await pipelineRunner.display(options);
    await sleep(1_000);
  }
};

const sleep = (millis: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, millis));
};
