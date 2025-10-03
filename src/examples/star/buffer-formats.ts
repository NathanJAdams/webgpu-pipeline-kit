import { WPKBufferFormat } from '../..';
import { Star, StarUniform } from './instance-formats';

export const uniforms = {
  bufferType: 'uniform',
  marshall: {
    'viewProjection': {
      datumType: 'mat4x4<f32>',
      matrix: 'camera.viewProjectionMatrix',
    }
  },
} as const satisfies WPKBufferFormat<StarUniform, Star>;

export const position = {
  bufferType: 'marshalled',
  marshall: {
    'transformation': {
      datumType: 'mat4x4<f32>',
      matrix: 'visual.transformation.matrix',
    }
  }
} as const satisfies WPKBufferFormat<StarUniform, Star>;

export const visual = {
  bufferType: 'marshalled',
  marshall: {
    'color': {
      datumType: 'vec3<f32>',
      vector: 'visual.color.valuesRgb',
    }
  }
} as const satisfies WPKBufferFormat<StarUniform, Star>;

export const bufferFormats = {
  uniforms,
  position,
  visual,
} as const;

export type StarBufferFormats = typeof bufferFormats;
