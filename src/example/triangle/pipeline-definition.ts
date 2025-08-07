import { WPKPipelineDefinition } from 'webgpu-pipeline-kit';

import { bufferFormats, BufferFormats } from './buffer-formats';
import { entityCacheResizeable, uniformCache } from './caches';
import { EntityFormat, UniformFormat } from './instance-formats';
import { meshFactories, MeshFactories } from './meshes';
import { shader } from './shader';

export const pipelineDefinition: WPKPipelineDefinition<UniformFormat, EntityFormat, BufferFormats, MeshFactories> = {
  name: 'triangle',
  meshFactories,
  bufferFormats,
  shader,
  uniformCache,
  entityCache: entityCacheResizeable,
};
