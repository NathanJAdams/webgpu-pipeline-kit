import { Star, StarUniform } from './instance-formats';
import { WPKBufferFormat } from '../..';

export const uniforms = {
  structType: 'uniform',
  marshall: {
    'viewProjection': {
      datumType: 'mat4x4<f32>',
      matrix: 'camera.viewProjectionMatrix',
    }
  },
} as const satisfies WPKBufferFormat<StarUniform, Star>;

export const position = {
  structType: 'marshalled',
  marshall: {
    'transformation': {
      datumType: 'mat4x4<f32>',
      matrix: 'visual.transformation.matrix',
    }
  }
} as const satisfies WPKBufferFormat<StarUniform, Star>;

export const visual = {
  structType: 'marshalled',
  marshall: {
    'color': {
      datumType: 'vec3<f32>',
      vector: 'visual.color.valuesRgb',
    }
  }
} as const satisfies WPKBufferFormat<StarUniform, Star>;

const varyings = {
  structType: 'varyings',
  varyings: {
    color: 'vec3<f32>',
  },
} as const satisfies WPKBufferFormat<StarUniform, Star>;

export const bufferFormats = {
  uniforms,
  position,
  visual,
  varyings,
} as const;

export type StarBufferFormats = typeof bufferFormats;
