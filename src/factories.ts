import { displayFactory } from './display';
import { meshFactory } from './meshes';
import { pipelineFactory } from './pipeline';
import { colorFactory } from './utils';

export const factories = {
  color: colorFactory,
  mesh: meshFactory,
  pipeline: pipelineFactory,
  display: displayFactory,
};
