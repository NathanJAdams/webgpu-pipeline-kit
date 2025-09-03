import { builders } from '../..';
import { Triangle, TriangleUniform } from './instance-formats';

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

const offsets = builders.bufferFormat<TriangleUniform, Triangle>()
  .bufferType('editable')
  .layoutArray()
  .index0Object()
  .name('offset')
  .datumType('vec2<f32>')
  .buildIndex0()
  .buildLayout()
  .buildObject();

export const bufferFormats = {
  uniforms,
  offsets,
} as const;

export type BufferFormats = typeof bufferFormats;
