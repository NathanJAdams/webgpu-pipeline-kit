import { cacheFactory } from './cache';
import { meshFactory } from './meshes';
import { pipelineRunnerFactory } from './pipeline';
import { colorFactory } from './utils';

export const factories = {
  color: colorFactory,
  cache: cacheFactory,
  mesh: meshFactory,
  pipelineRunner: pipelineRunnerFactory,
};
