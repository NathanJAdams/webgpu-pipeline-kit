import { WPKInstanceFormat, WPKInstanceOf } from 'webgpu-pipeline-kit';

export const uniformFormat = {
  gameTime: 'number',
} as const satisfies WPKInstanceFormat;

export type UniformFormat = typeof uniformFormat;
export type Uniform = WPKInstanceOf<UniformFormat>;

export const entityFormat = {
  exampleTuple: ['number', 'boolean', 'string'],
  exampleObject: {
    a: 'number',
    b: ['number', 'number'],
    c: {
      nested: {
        x: 'number',
        y: 'number',
        z: 'number',
      }
    }
  }
} as const satisfies WPKInstanceFormat;

export type EntityFormat = typeof entityFormat;
export type Entity = WPKInstanceOf<EntityFormat>;
