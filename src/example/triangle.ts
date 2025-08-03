import { WPKBufferFormatMap } from '../buffer-formats';
import { cacheFactory } from '../cache';
import { WPKInstanceFormat, WPKInstanceOf } from '../instance';
import { meshFactory } from '../mesh';
import { pipelineFactory, WPKPipelineOptions } from '../pipeline';
import { pipelineRunnerFactory } from '../pipeline-runner';
import { WPKShader } from '../shaders';
import { colorFactory } from '../utils';

const uniformFormat = {
  gameTime: 'number',
} as const satisfies WPKInstanceFormat;
type TriangleUniformFormat = typeof uniformFormat;
type TriangleUniform = WPKInstanceOf<TriangleUniformFormat>;

const triangleFormat = {
  primaryId: 'string',
  positionTuple: ['number', 'number', 'number'],
  positionObject: {
    x: 'number',
    y: 'number',
    z: 'number',
  },
} as const satisfies WPKInstanceFormat;
type TriangleFormat = typeof triangleFormat;

type Triangle = WPKInstanceOf<TriangleFormat>;

const uniform: TriangleUniform = {
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

const uniformCache = cacheFactory.ofUniform(uniformFormat, uniform, false);
const entityCache = cacheFactory.ofEntitiesResizeable(triangleFormat, true);

const triangleBufferFormats = {
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
      datumType: 'sint8',
      vec2: [
        'positionObject.x',
        'positionObject.y',
      ],
    }, {
      datumType: 'uint32',
      vec3: 'positionTuple',
    }, {
      datumType: 'sint32',
      entityIndexFromResizeableEntityCache: {
        key: 'primaryId',
        target: entityCache,
      },
    }],
  },
} satisfies WPKBufferFormatMap<TriangleUniformFormat, TriangleFormat>;

type TriangleBufferFormats = typeof triangleBufferFormats;
const shader = {
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

const pipeline = pipelineFactory.of(
  'triangle',
  triangleBufferFormats,
  shader,
  uniformCache,
  entityCache
);

const _testFunction = async () => {
  const canvas = {} as HTMLCanvasElement;
  const pipelineRunner = await pipelineRunnerFactory.of(canvas, pipeline);
  const options: WPKPipelineOptions = {
    clear: colorFactory.BLACK,
    isAntiAliased: true,
  };
  pipelineRunner.invoke(options);
};
