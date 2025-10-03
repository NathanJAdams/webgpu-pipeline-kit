import { WPKBufferFormat } from '../..';
import { Triangle, TriangleUniform } from './instance-formats';

export const uniforms = {
  bufferType: 'uniform',
  marshall: {
    'gameTime': {
      datumType: 'f32',
      scalar: 'gameTime',
    },
  },
} as const satisfies WPKBufferFormat<TriangleUniform, Triangle>;

const offsets = {
  bufferType: 'editable',
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
