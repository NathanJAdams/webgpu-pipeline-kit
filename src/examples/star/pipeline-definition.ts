import { bufferFormats, StarBufferFormats } from './buffer-formats';
import { Star, StarUniform } from './instance-formats';
import { meshTemplates, StarMeshTemplates } from './mesh-templates';
import { starShader } from './shader';
import { builders, Camera, Vector3 } from '../..';

export const camera = new Camera(true);
camera.setPosition(Vector3.ZERO);
camera.flushChanges();

export const starPipelineOptions = builders.pipelineOptions<StarUniform, Star, true, true, true>()
  .mutableUniform(true)
  .mutableEntities(true)
  .resizeableEntities(true)
  .initialUniformObject().camera(camera).buildInitialUniform()
  .initialEntities([])
  .buildObject();

export const starPipelineDefinition = builders.pipelineDefinition<StarUniform, Star, StarBufferFormats, StarMeshTemplates>()
  .name('star')
  .bufferFormats(bufferFormats)
  .meshFactories(meshTemplates)
  .shader(starShader)
  .buildObject();
