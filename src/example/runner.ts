import { factories, setLogLevel, WPKPipelineOptions } from 'webgpu-pipeline-kit';

import { entity, entityCacheResizeable, pipelineDefinition } from './triangle';

export const run = async (): Promise<void> => {
  setLogLevel('DEBUG');
  const canvas = document.getElementById('game-canvas') as (HTMLCanvasElement | null);
  if (canvas === null) {
    throw Error('Failed to get game canvas from document');
  }
  const pipelineRunner = await factories.pipelineRunner.of(canvas);
  pipelineRunner.add('triangle', pipelineDefinition);
  const options: WPKPipelineOptions = {
    clear: factories.color.BLACK,
    isAntiAliased: true,
  };
  await pipelineRunner.invoke(options);
  while (true) {
    entityCacheResizeable.add(entity);
    await pipelineRunner.invoke(options);
    sleep(1_000);
  }
};

const sleep = (millis: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, millis));
};
