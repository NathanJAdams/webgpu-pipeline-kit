import { meshFactory, meshTemplateFactory } from './mesh-factories';
import { pipelineFactory } from './pipeline';
import { pipelineRunnerFactory } from './pipeline-runner';

export const factories = {
  mesh: meshFactory,
  meshTemplate: meshTemplateFactory,
  pipeline: pipelineFactory,
  pipelineRunner: pipelineRunnerFactory,
};
