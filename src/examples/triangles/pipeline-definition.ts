import { builders } from '../..';
import { bufferFormats, BufferFormats } from './buffer-formats';
import { Triangle, TriangleUniform } from './instance-formats';
import { meshTemplates, MeshTemplates } from './mesh-templates';
import { shader } from './shader';

export const pipelineOptions = builders.pipelineOptions<TriangleUniform, Triangle, true, true, true>()
  .mutableUniform(true)
  .mutableEntities(true)
  .resizeableEntities(true)
  .initialUniformObject().gameTime(0).buildInitialUniform()
  .initialEntities([])
  .buildObject();

export const pipelineDefinition = builders.pipelineDefinition<TriangleUniform, Triangle, BufferFormats, MeshTemplates>()
  .name('triangle')
  .bufferFormats(bufferFormats)
  .meshFactories(meshTemplates)
  .shader(shader)
  .buildObject();
