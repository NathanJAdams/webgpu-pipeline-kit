import { displayFactory } from './display';
import { meshFactory, meshTemplateFactory } from './mesh-factories';
import { pipelineFactory } from './pipeline';

export const factories = {
  mesh: meshFactory,
  meshTemplate: meshTemplateFactory,
  pipeline: pipelineFactory,
  display: displayFactory,
};
