import { WPKShader } from 'webgpu-pipeline-kit';

import { BufferFormats } from './buffer-formats';
import { EntityFormat, UniformFormat } from './instance-formats';
import { MeshFactories } from './meshes';

export const shader: WPKShader<UniformFormat, EntityFormat, BufferFormats, MeshFactories> = {
  compute: {
    shader: `
      @group(0) @binding(0)
      var<uniform> uniforms: vec2<f32>;

      @group(0) @binding(1)
      var<storage, read_write> offsets: array<vec2<f32>>;

      @compute @workgroup_size(1)
      fn main(@builtin(global_invocation_id) id: vec3<u32>) {
          let i = id.x;
          let angle = f32(i) * 6.28318 / 60.0;
          offsets[i] = vec2<f32>(cos(angle), sin(angle)) * 0.95;
      }`,
    bufferBindings: [{
      group: 0,
      binding: 0,
      buffer: 'uniforms',
    }, {
      group: 0,
      binding: 1,
      buffer: 'offsets',
    }],
    passes: [{
      entryPoint: 'main',
      workGroupSize: {
        x: 1,
      },
    }],
  },
  render: {
    shader: `
      @group(1) @binding(0)
      var<uniform> uniforms: vec2<f32>;

      @group(1) @binding(1)
      var<storage, read> offsets: array<vec2<f32>>;

      @vertex
      fn vertex_main(
          @location(0) pos: vec3<f32>,
          @location(1) offset: vec2<f32>
      ) -> @builtin(position) vec4<f32> {
          return vec4<f32>(0.025 * pos.xy + offset, 0.0, 1.0);
      }

      @fragment
      fn fragment_main() -> @location(0) vec4<f32> {
          return vec4(1.0, 0.3, 0.3, 1.0);
      }`,
    bufferBindings: [{
      group: 1,
      binding: 0,
      buffer: 'uniforms',
    }, {
      group: 1,
      binding: 1,
      buffer: 'offsets',
    }],
    passes: [{
      mesh: {
        key: 'ball',
        parameters: {
          subdivisions: 4,
        },
      },
      vertex: {
        entryPoint: 'vertex_main',
        bufferLocations: [{
          type: 'mesh',
          step: 'vertex',
          location: 0,
          format: 'float32x3',
        }, {
          type: 'user-defined',
          step: 'instance',
          location: 1,
          buffer: 'offsets',
        }],
      },
      fragment: {
        entryPoint: 'fragment_main',
      },
    }],
  },
};
