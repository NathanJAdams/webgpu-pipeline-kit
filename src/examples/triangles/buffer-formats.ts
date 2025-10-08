import { Triangle, TriangleUniform } from './instance-formats';
import { WPKBufferFormat } from '../..';

export const uniforms = {
  structType: 'uniform',
  marshall: {
    'gameTime': {
      datumType: 'f32',
      scalar: 'gameTime',
    },
  },
} as const satisfies WPKBufferFormat<TriangleUniform, Triangle>;

const offsets = {
  structType: 'editable',
  layout: {
    'offset': {
      datumType: 'vec2<f32>',
    },
  },
} as const satisfies WPKBufferFormat<TriangleUniform, Triangle>;

export const bufferFormats = {
  uniforms,
  offsets,
} as const;

export type BufferFormats = typeof bufferFormats;
