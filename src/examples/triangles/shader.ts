import { builders } from '../..';
import { BufferFormats } from './buffer-formats';
import { Triangle, TriangleUniform } from './instance-formats';
import { MeshTemplates } from './mesh-templates';

const computeGroupBindings = builders.computeGroupBindings<TriangleUniform, Triangle, BufferFormats>()
  .pushObject().group(0).binding(0).buffer('uniforms').buildElement()
  .pushObject().group(0).binding(1).buffer('offsets').buildElement()
  .buildArray();

const computeShader = builders.computeShader<TriangleUniform, Triangle, BufferFormats>()
  .groupBindings(computeGroupBindings)
  .passesArray()
  .pushObject()
  .workGroupSize({ x: 64 })
  .entryPoint('compute_pass_1')
  .code((params, wgsl) => wgsl`  let angle = f32(${params.instance_index}) * 6.28318 / 60.0;
  ${params.bindings.offsets.offset} = vec2<f32>(cos(angle), sin(angle)) * 0.95;`
  )
  .build()
  .buildPasses()
  .buildObject();

const meshTemplate = builders.meshTemplate<MeshTemplates>()
  .key('triangle')
  .parametersObject()
  .top(0.5)
  .buildParameters()
  .buildObject();

const vertexShader = builders.vertexShader<TriangleUniform, Triangle, BufferFormats>()
  .entryPoint('vertex_main')
  .returnType('builtin_position')
  .vertexBuffersArray()
  .pushObject().buffer('offsets').field('offset').buildElement()
  .buildVertexBuffers()
  .code((params, wgsl) => wgsl`  return vec4<f32>((0.025 * ${params.vertex_position.xy}) + ${params.vertex_buffers.offsets.offset}, 0.0, 1.0);`)
  .buildObject();

const fragmentShader = builders.fragmentShader<TriangleUniform, Triangle, BufferFormats>()
  .entryPoint('fragment_main')
  .code((_params, wgsl) => wgsl`  return vec4<f32>(1.0, 0.0, 0.0, 1.0);`)
  .buildObject();

const renderGroupBindings = builders.renderGroupBindings<TriangleUniform, Triangle, BufferFormats>()
  .pushObject().group(0).binding(0).buffer('uniforms').buildElement()
  .buildArray();

const renderShader = builders.renderShader<TriangleUniform, Triangle, BufferFormats, MeshTemplates>()
  .groupBindings(renderGroupBindings)
  .passesArray()
  .pushObject()
  .mesh(meshTemplate)
  .vertex(vertexShader)
  .fragment(fragmentShader)
  .buildElement()
  .buildPasses()
  .buildObject();

export const shader = builders.shader<TriangleUniform, Triangle, BufferFormats, MeshTemplates>()
  .compute(computeShader)
  .render(renderShader)
  .buildObject();
