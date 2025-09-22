import { describe, test, expect } from 'vitest';
import { WPKBufferFormat, WPKVertexBufferLocation } from '../src/types';
import { shaderFuncs } from '../src/shader-utils';

type Uniform = {
  uniformScalar: number;
  uniformVector: [number, number];
  uniformMatrix: [
    [number, number],
    [number, number],
  ];
};

type Entity = {
  entityScalar: number;
  entityVector: [number, number];
  entityMatrix: [
    [number, number],
    [number, number],
  ];
};

const uniforms = {
  bufferType: 'uniform',
  marshall: [{
    name: 's',
    datumType: 'f32',
    scalar: 'uniformScalar',
  }, {
    name: 'v',
    datumType: 'vec2<f32>',
    vector: 'uniformVector',
  }, {
    name: 'm',
    datumType: 'mat2x2<f32>',
    matrix: 'uniformMatrix',
  }],
} as const satisfies WPKBufferFormat<Uniform, Entity>;

const marshalleds = {
  bufferType: 'marshalled',
  marshall: [{
    name: 'ms',
    datumType: 'f32',
    scalar: 'entityScalar',
  }, {
    name: 'mv',
    datumType: 'vec2<f32>',
    vector: 'entityVector',
  }, {
    name: 'mm',
    datumType: 'mat2x2<f32>',
    matrix: 'entityMatrix',
  }],
} as const satisfies WPKBufferFormat<Uniform, Entity>;

const editables = {
  bufferType: 'editable',
  layout: [{
    name: 'es',
    datumType: 'f32',
  }, {
    name: 'ev',
    datumType: 'vec2<f32>',
  }, {
    name: 'em',
    datumType: 'mat2x2<f32>',
  }],
} as const satisfies WPKBufferFormat<Uniform, Entity>;

const bufferFormats = {
  uniforms,
  marshalleds,
  editables,
};
type BufferFormatMap = typeof bufferFormats;

describe('vertex buffer attribute data', () => {
  test('an element can be added and found again only after pack()', () => {
    const vertexBufferLocations: WPKVertexBufferLocation<Uniform, Entity, BufferFormatMap>[] = [{
      buffer: 'marshalleds',
      field: 'ms',
    }, {
      buffer: 'marshalleds',
      field: 'mv',
    }, {
      buffer: 'marshalleds',
      field: 'mm',
    }, {
      buffer: 'editables',
      field: 'es',
    }, {
      buffer: 'editables',
      field: 'ev',
    }, {
      buffer: 'editables',
      field: 'em',
    }];
    const attributes = shaderFuncs.toVertexBufferAttributeData(vertexBufferLocations, bufferFormats);
    console.log(JSON.stringify(attributes));
  });
});
