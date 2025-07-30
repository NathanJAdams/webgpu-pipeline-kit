import { meshFactory } from './mesh';
import { pipelineFactory } from './pipeline';
import { pipelineRunnerFactory } from './pipeline-runner';
import { colorFactory } from './utils';

export const factories = {
  color: colorFactory,
  mesh: meshFactory,
  pipeline: pipelineFactory,
  pipelineRunner: pipelineRunnerFactory,
};
