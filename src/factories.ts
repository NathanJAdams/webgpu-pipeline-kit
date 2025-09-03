import { displayFactory } from './display';
import { meshFactory, meshTemplateFactory } from './mesh-factories';
import { pipelineFactory } from './pipeline';
import { colorFactory } from './utils';

export const factories = {
  color: colorFactory,
  mesh: meshFactory,
  meshTemplate: meshTemplateFactory,
  pipeline: pipelineFactory,
  display: displayFactory,
};
