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

const vertexShader = builders.vertexShader<StarUniform, Star, StarBufferFormats, 'varyings'>()
  .entryPoint('star_vertex')
  .vertexBuffersArray()
  .pushObject().buffer('position').field('transformation').buildElement()
  .pushObject().buffer('visual').field('color').buildElement()
  .buildVertexBuffers()
  .output('varyings')
  .code((wgsl, params) =>
    wgsl`  let model_position = ${params.vertex_buffers.position.transformation} * vec4<f32>(${params.vertex_position}, 1.0);
  var output : ${params.output.type};
  output.builtin_position = ${params.bindings.uniforms.viewProjection} * model_position;
  output.color = ${params.vertex_buffers.visual.color};
  return output;`)
  .buildObject();

const fragmentShader = builders.fragmentShader<StarUniform, Star, StarBufferFormats, 'varyings'>()
  .entryPoint('star_fragment')
  .input('varyings')
  .code((wgsl, params) => wgsl`  return vec4<f32>(${params.input.color}, 1.0);`)
  .buildObject();

const renderGroupBindings = builders.renderGroupBindings<StarUniform, Star, StarBufferFormats>()
  .pushObject().group(0).binding(0).buffer('uniforms').buildElement()
  .buildArray();

export const renderShader = builders.renderShader<StarUniform, Star, StarBufferFormats, StarMeshTemplates, 'varyings'>()
  .groupBindings(renderGroupBindings)
  .passesArray()
  .pushObject()
  .mesh(meshTemplate)
  .vertex(vertexShader)
  .fragment(fragmentShader)
  .buildElement()
  .buildPasses()
  .buildObject();
