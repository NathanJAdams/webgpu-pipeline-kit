import { WPKBufferFormatMap } from '../buffer-formats';
import { cacheFactory } from '../cache';
import { WPKInstanceFormat, WPKInstanceOf } from '../instance';
import { meshFactory } from '../mesh';
import { pipelineFactory } from '../pipeline';
import { WPKShader } from '../shaders';

const _uniformFormat = {
  gameTime: 'number',
} as const satisfies WPKInstanceFormat;
type TriangleUniformFormat = typeof _uniformFormat;
type TriangleUniform = WPKInstanceOf<TriangleUniformFormat>;

const _triangleFormat = {
  primaryId: 'string',
  positionTuple: ['number', 'number', 'number'],
  positionObject: {
    x: 'number',
    y: 'number',
    z: 'number',
  },
} as const satisfies WPKInstanceFormat;
type TriangleFormat = typeof _triangleFormat;

type Triangle = WPKInstanceOf<TriangleFormat>;

const _uniform: TriangleUniform = {
  gameTime: 123,
};
const _triangle: Triangle = {
  primaryId: 'abc',
  positionTuple: [546, 12.4, -900],
  positionObject: {
    x: 123,
    y: 456,
    z: 789,
  },
};

const _uniformCache = cacheFactory.ofUniform(_uniform, false);
const _entityCacheFixed = cacheFactory.ofEntitiesFixedSize(true, _triangle);
const _entityCacheResizeable = cacheFactory.ofEntitiesResizeable(true);

const _triangleBufferFormats = {
  uniforms: {
    bufferType: 'uniform',
    contentType: 'marshalled',
    marshall: [{
      datumType: 'uint32',
      scalar: 'gameTime',
    }],
  },
  calculated: {
    bufferType: 'entity',
    contentType: 'layout',
    layout: [{
      datumType: 'float32',
      dimension: 'scalar',
    }],
  },
  physical: {
    bufferType: 'entity',
    contentType: 'marshalled',
    marshall: [{
      datumType: 'float16',
      scalar: 'positionTuple.0',
    }, {
      datumType: 'sint32',
      vec3: 'positionTuple',
    }, {
      datumType: 'sint32',
      entityIndexFromResizeableEntityCache: {
        key: 'primaryId',
        target: _entityCacheResizeable,
      },
    }],
  },
} satisfies WPKBufferFormatMap<TriangleUniformFormat, TriangleFormat>;

type TriangleBufferFormats = typeof _triangleBufferFormats;
const _shader = {
  compute: {
    bufferBindings: [{
      binding: 0,
      buffer: 'uniforms',
      group: 0,
    }],
    shader: '',
    passes: [{
      entryPoint: 'main',
      workGroupSize: {
        x: 64,
      },
    }],
  },
  render: {
    bufferBindings: [{
      binding: 0,
      group: 1,
      buffer: 'physical',
    }],
    mesh: meshFactory.sphere(4),
    passes: [{
      vertex: {
        entryPoint: '',
        bufferLocations: [{
          type: 'mesh',
          step: 'vertex',
          format: 'float32x3',
          location: 0,
        }, {
          type: 'user-defined',
          step: 'instance',
          location: 0,
          buffer: 'physical',
        }],
      },
      fragment: {
        entryPoint: '',
      },
    }],
    shader: '',
  },
} as const satisfies WPKShader<TriangleUniformFormat, TriangleFormat, TriangleBufferFormats>;

// const pipeline = pipelineFactory.of(
//   'triangle',
//   _triangleBufferFormats,
//   _shader,
//   _uniformCache,
//   _entityCacheResizeable
// );
