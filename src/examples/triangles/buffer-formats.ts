import { builders } from '../..';
import { Triangle, TriangleUniform } from './instance-formats';
import { WPKBufferFormat } from '../../types';

const uniforms = builders.bufferFormat<TriangleUniform, Triangle>()
  .bufferType('uniform')
  .marshallArray()
  .index0Object()
  .name('gameTime')
  .datumType('f32')
  .scalar('gameTime')
  .buildIndex0()
  .buildMarshall()
  .buildObject();

const offsets = {
  bufferType: 'editable',
  layout: [
    {
      name: 'offset',
      datumType: 'vec2<f32>',
    },
  ],
} as const satisfies WPKBufferFormat<TriangleUniform, Triangle>;

export const bufferFormats = {
  uniforms,
  offsets,
} as const;

export type BufferFormats = typeof bufferFormats;
