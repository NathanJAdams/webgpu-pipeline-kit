import { WPKBufferFormatMap } from '../buffer-format';
import { WPKInstanceFormat, WPKInstanceOf } from '../instance';

const _uniformFormat = {
  gameTime: 'number',
} as const satisfies WPKInstanceFormat;
type UniformFormat = typeof _uniformFormat;

const _triangleFormat = {
  positionTuple: ['number', 'number', 'number'],
  positionObject: {
    x: 'number',
    y: 'number',
    z: 'number',
  },
} as const satisfies WPKInstanceFormat;
type TriangleFormat = typeof _triangleFormat;

type Triangle = WPKInstanceOf<TriangleFormat>;

const _triangle: Triangle = {
  positionTuple: [546, 12.4, -900],
  positionObject: {
    x: 123,
    y: 456,
    z: 789,
  },
};

const _buffers = {
  uniforms: {
    bufferType: 'uniform',
    contentType: 'marshalled',
    marshall: [{
      datumType: 'float32',
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
      datumType: 'float32',
      scalar: 'positionTuple.0',
    }, {
      datumType: 'float32',
      vec3: 'positionTuple',
    }]
  }
} as const satisfies WPKBufferFormatMap<UniformFormat, TriangleFormat>;
