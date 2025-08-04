import { cacheFactory } from './cache';
import { meshFactory } from './mesh';
import { pipelineRunnerFactory } from './pipeline';
import { shaderFactory } from './shaders';
import { colorFactory } from './utils';

export const factories = {
  color: colorFactory,
  cache: cacheFactory,
  mesh: meshFactory,
  pipelineRunner: pipelineRunnerFactory,
  shader: shaderFactory,
};
