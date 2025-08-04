import { factories, WPKBufferFormatMap, WPKInstanceFormat, WPKInstanceOf, WPKPipelineDefinition, WPKPipelineOptions, WPKShader } from 'webgpu-pipeline-kit';

const uniformFormatTriangle = {
  gameTimeTriangle: 'number',
} as const satisfies WPKInstanceFormat;
type UniformFormatTriangle = typeof uniformFormatTriangle;
type UniformTriangle = WPKInstanceOf<UniformFormatTriangle>;

const entityFormatTriangle = {
  primaryIdTriangle: 'string',
  positionTupleTriangle: ['number', 'number', 'number'],
  positionObjectTriangle: {
    x: 'number',
    y: 'number',
    z: 'number',
  },
} as const satisfies WPKInstanceFormat;
type EntityFormatTriangle = typeof entityFormatTriangle;

type EntityTriangle = WPKInstanceOf<EntityFormatTriangle>;

const uniformTriangle: UniformTriangle = {
  gameTimeTriangle: 123,
};
const _entityTriangle: EntityTriangle = {
  primaryIdTriangle: 'abc',
  positionTupleTriangle: [546, 12.4, -900],
  positionObjectTriangle: {
    x: 123,
    y: 456,
    z: 789,
  },
};

const uniformCacheTriangle = factories.cache.ofUniform(uniformFormatTriangle, uniformTriangle, false);
const entityCacheTriangle = factories.cache.ofEntitiesResizeable(entityFormatTriangle, true);

const bufferFormatsTriangle = {
  uniformsTriangle: {
    bufferType: 'uniform',
    contentType: 'marshalled',
    marshall: [{
      datumType: 'uint32',
      scalar: 'gameTimeTriangle',
    }],
  },
  calculatedTriangle: {
    bufferType: 'entity',
    contentType: 'layout',
    layout: [{
      datumType: 'float32',
      dimension: 'scalar',
    }],
  },
  physicalTriangle: {
    bufferType: 'entity',
    contentType: 'marshalled',
    marshall: [{
      datumType: 'float16',
      scalar: 'positionTupleTriangle.0',
    }, {
      datumType: 'sint8',
      vec2: [
        'positionObjectTriangle.x',
        'positionObjectTriangle.y',
      ],
    }, {
      datumType: 'uint32',
      vec3: 'positionTupleTriangle',
    }, {
      datumType: 'sint32',
      entityIndexFromResizeableEntityCache: {
        key: 'primaryIdTriangle',
        target: entityCacheTriangle,
      },
    }],
  },
} as const satisfies WPKBufferFormatMap<UniformFormatTriangle, EntityFormatTriangle>;

type BufferFormatsTriangle = typeof bufferFormatsTriangle;
const shaderTriangle: WPKShader<UniformFormatTriangle, EntityFormatTriangle, BufferFormatsTriangle> = {
  compute: {
    bufferBindings: [{
      binding: 0,
      buffer: 'uniformsTriangle',
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
      buffer: 'physicalTriangle',
    }],
    mesh: factories.mesh.sphere(4),
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
          buffer: 'physicalTriangle',
        }],
      },
      fragment: {
        entryPoint: '',
      },
    }],
    shader: '',
  },
};

const pipelineDefinitionTriangle: WPKPipelineDefinition<UniformFormatTriangle, EntityFormatTriangle, BufferFormatsTriangle> = {
  name: 'triangle',
  bufferFormats: bufferFormatsTriangle,
  shader: shaderTriangle,
  uniformCache: uniformCacheTriangle,
  entityCache: entityCacheTriangle,
};

const uniformFormatCube = {
  gameTimeCube: 'number',
} as const satisfies WPKInstanceFormat;
type UniformFormatCube = typeof uniformFormatCube;
type UniformCube = WPKInstanceOf<UniformFormatCube>;

const entityFormatCube = {
  primaryIdCube: 'string',
  positionTupleCube: ['number', 'number', 'number'],
  positionObjectCube: {
    x: 'number',
    y: 'number',
    z: 'number',
  },
} as const satisfies WPKInstanceFormat;
type EntityFormatCube = typeof entityFormatCube;

type EntityCube = WPKInstanceOf<EntityFormatCube>;

const uniformCube: UniformCube = {
  gameTimeCube: 123,
};
const _entityCube: EntityCube = {
  primaryIdCube: 'abc',
  positionTupleCube: [546, 12.4, -900],
  positionObjectCube: {
    x: 123,
    y: 456,
    z: 789,
  },
};

const uniformCacheCube = factories.cache.ofUniform(uniformFormatCube, uniformCube, false);
const entityCacheCube = factories.cache.ofEntitiesResizeable(entityFormatCube, true);

const bufferFormatsCube = {
  uniformsCube: {
    bufferType: 'uniform',
    contentType: 'marshalled',
    marshall: [{
      datumType: 'uint32',
      scalar: 'gameTimeCube',
    }],
  },
  calculatedCube: {
    bufferType: 'entity',
    contentType: 'layout',
    layout: [{
      datumType: 'float32',
      dimension: 'scalar',
    }],
  },
  physicalCube: {
    bufferType: 'entity',
    contentType: 'marshalled',
    marshall: [{
      datumType: 'float16',
      scalar: 'positionTupleCube.0',
    }, {
      datumType: 'sint8',
      vec2: [
        'positionObjectCube.x',
        'positionObjectCube.y',
      ],
    }, {
      datumType: 'uint32',
      vec3: 'positionTupleCube',
    }, {
      datumType: 'sint32',
      entityIndexFromResizeableEntityCache: {
        key: 'primaryIdCube',
        target: entityCacheTriangle,
      },
    }],
  },
} as const satisfies WPKBufferFormatMap<UniformFormatCube, EntityFormatCube>;

type BufferFormatsCube = typeof bufferFormatsCube;
const shaderCube: WPKShader<UniformFormatCube, EntityFormatCube, BufferFormatsCube> = {
  compute: {
    bufferBindings: [{
      binding: 0,
      buffer: 'uniformsCube',
      group: 0,
    }, {
      binding: 1,
      group: 0,
      buffer: factories.shader.ofForeignBufferRef(uniformFormatTriangle, entityFormatTriangle, bufferFormatsTriangle, 'calculatedTriangle'),
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
      buffer: 'physicalCube',
    }, {
      binding: 1,
      group: 1,
      buffer: factories.shader.ofForeignBufferRef(uniformFormatTriangle, entityFormatTriangle, bufferFormatsTriangle, 'uniformsTriangle'),
    }],
    mesh: factories.mesh.sphere(4),
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
          buffer: 'physicalCube',
        }],
      },
      fragment: {
        entryPoint: '',
      },
    }],
    shader: '',
  },
};

const pipelineDefinitionCube: WPKPipelineDefinition<UniformFormatCube, EntityFormatCube, BufferFormatsCube> = {
  name: 'cube',
  bufferFormats: bufferFormatsCube,
  shader: shaderCube,
  uniformCache: uniformCacheCube,
  entityCache: entityCacheCube,
};

const _testFunction = async () => {
  const canvas = {} as HTMLCanvasElement;
  const pipelineRunner = await factories.pipelineRunner.of(canvas, pipelineDefinitionTriangle, pipelineDefinitionCube);
  const options: WPKPipelineOptions = {
    clear: factories.color.BLACK,
    isAntiAliased: true,
  };
  pipelineRunner.invoke(options);
};
