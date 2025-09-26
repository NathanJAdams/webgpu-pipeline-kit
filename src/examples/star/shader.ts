import { StarBufferFormats } from './buffer-formats';
import { Star, StarUniform } from './instance-formats';
import { StarMeshTemplates } from './mesh-templates';
import { builders } from '../..';

const meshTemplate = builders.meshTemplate<StarMeshTemplates>()
  .key('sphere')
  .parametersObject()
  .subdivisions(4)
  .buildParameters()
  .buildObject();

const vertexShader = builders.vertexShader<StarUniform, Star, StarBufferFormats>()
  .entryPoint('star_vertex')
  .returnType('builtin_position')
  .vertexBuffersArray()
  .pushObject().buffer('position').field('transformation').buildElement()
  .pushObject().buffer('visual').field('color').buildElement()
  .buildVertexBuffers()
  .code((wgsl, params) => wgsl`
  let model_position = ${params.vertex_buffers.position.transformation} * vec4<f32>(${params.vertex_position}, 1.0);
  return ${params.bindings.uniforms.viewProjection} * model_position;
`)
  .buildObject();

const fragmentShader = builders.fragmentShader<StarUniform, Star, StarBufferFormats>()
  .entryPoint('star_fragment')
  .code((wgsl, _params) => wgsl`  return vec4<f32>(0.9, 0.7, 0.5, 1.0);`)
  .buildObject();

const renderGroupBindings = builders.renderGroupBindings<StarUniform, Star, StarBufferFormats>()
  .pushObject().group(0).binding(0).buffer('uniforms').buildElement()
  .buildArray();

export const renderShader = builders.renderShader<StarUniform, Star, StarBufferFormats, StarMeshTemplates>()
  .groupBindings(renderGroupBindings)
  .passesArray()
  .pushObject()
  .mesh(meshTemplate)
  .vertex(vertexShader)
  .fragment(fragmentShader)
  .buildElement()
  .buildPasses()
  .buildObject();
