import { builders, Camera } from '../..';
import { bufferFormats, OrbiterBufferFormats } from './buffer-formats';
import { Orbiter, OrbiterUniform } from './instance-formats';
import { meshTemplates, OrbiterMeshTemplates } from './mesh-templates';
import { orbiterShader } from './shader';

export const camera = new Camera(true);

export const orbiterPipelineOptions = builders.pipelineOptions<OrbiterUniform, Orbiter, true, true, true>()
  .mutableUniform(true)
  .mutableEntities(true)
  .resizeableEntities(true)
  .initialUniformObject().gameTime(0).camera(camera).buildInitialUniform()
  .initialEntities([])
  .buildObject();

export const orbiterPipelineDefinition = builders.pipelineDefinition<OrbiterUniform, Orbiter, OrbiterBufferFormats, OrbiterMeshTemplates>()
  .name('orbiter')
  .bufferFormats(bufferFormats)
  .meshFactories(meshTemplates)
  .shader(orbiterShader)
  .buildObject();
