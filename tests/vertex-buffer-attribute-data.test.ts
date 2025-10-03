import { WPKBufferFormat, WPKBufferFormatMap, WPKVertexBufferLocation } from '../src/types';
import { shaderFuncs } from '../src/shader-utils';
import { bufferLayoutsFuncs } from '../src/buffer-layout';
import { cacheFactory } from '../src/cache';
import expectedAttributes from './fixtures/attributes.json';

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
  marshall: {
    s: {
      datumType: 'f32',
      scalar: 'uniformScalar',
    },
    v: {
      datumType: 'vec2<f32>',
      vector: 'uniformVector',
    },
    m: {
      datumType: 'mat2x2<f32>',
      matrix: 'uniformMatrix',
    }
  },
} as const satisfies WPKBufferFormat<Uniform, Entity>;

const marshalleds = {
  bufferType: 'marshalled',
  marshall: {
    ms: {
      datumType: 'f32',
      scalar: 'entityScalar',
    },
    mv: {
      datumType: 'vec2<f32>',
      vector: 'entityVector',
    },
    mm: {
      datumType: 'mat2x2<f32>',
      matrix: 'entityMatrix',
    }
  },
} as const satisfies WPKBufferFormat<Uniform, Entity>;

const editables = {
  bufferType: 'editable',
  layout: {
    es: {
      datumType: 'f32',
    },
    ev: {
      datumType: 'vec2<f32>',
    },
    em: {
      datumType: 'mat2x2<f32>',
    }
  },
} as const satisfies WPKBufferFormat<Uniform, Entity>;

const bufferFormats = {
  uniforms,
  marshalleds,
  editables,
} as const satisfies WPKBufferFormatMap<Uniform, Entity>;
type BufferFormatMap = typeof bufferFormats;

describe('vertex buffer attribute data', () => {
  test('an element can be added and found again only after pack()', () => {
    const entityCache = cacheFactory.ofEntitiesFixedSize<Entity, true>(true);
    const bufferLayouts = bufferLayoutsFuncs.toBufferLayouts<Uniform, Entity, BufferFormatMap>(bufferFormats, entityCache, () => false, () => false);
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
    const attributes = shaderFuncs.toVertexBufferAttributeData(vertexBufferLocations, bufferLayouts);
    expect(attributes).toStrictEqual(expectedAttributes);
  });
});
