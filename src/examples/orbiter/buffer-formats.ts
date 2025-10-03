import { WPKBufferFormat } from '../..';
import { Orbiter, OrbiterUniform } from './instance-formats';

export const uniforms = {
  bufferType: 'uniform',
  marshall: {
    'gameTime': {
      datumType: 'f32',
      scalar: 'gameTime'
    },
    'camera': {
      datumType: 'mat4x4<f32>',
      matrix: 'camera.viewProjectionMatrix',
    }
  }
} as const satisfies WPKBufferFormat<OrbiterUniform, Orbiter>;

export const kepler = {
  bufferType: 'marshalled',
  marshall: {
    'primaryIndex': {
      datumType: 'i32',
      entityIdKey: 'kepler.primaryId'
    },
    'argumentOfPeriapsis': {
      datumType: 'vec2<f32>',
      vector: 'kepler.argumentOfPeriapsis'
    },
    'inclination': {
      datumType: 'vec2<f32>',
      vector: 'kepler.inclination'
    },
    'longitudeOfAscendingNode': {
      datumType: 'vec2<f32>',
      vector: 'kepler.longitudeOfAscendingNode'
    },
    'eccentricity': {
      datumType: 'f32',
      scalar: 'kepler.eccentricity'
    },
    'meanAnomaly': {
      datumType: 'f32',
      scalar: 'kepler.meanAnomaly'
    },
    'meanMotion': {
      datumType: 'f32',
      scalar: 'kepler.meanMotion'
    },
    'semiMajorAxis': {
      datumType: 'f32',
      scalar: 'kepler.semiMajorAxis'
    },
    'sqrt_OnePlusEccentricityOverOneMinusEccentricity': {
      datumType: 'f32',
      scalar: 'kepler.sqrt_OnePlusEccentricityOverOneMinusEccentricity'
    }
  },
} as const satisfies WPKBufferFormat<OrbiterUniform, Orbiter>;

export const position = {
  bufferType: 'editable',
  layout: {
    'position': {
      datumType: 'vec3<f32>',
    }
  }
} as const satisfies WPKBufferFormat<OrbiterUniform, Orbiter>;

export const visual = {
  bufferType: 'marshalled',
  marshall: {
    'color': {
      datumType: 'vec3<f32>',
      vector: 'visual.color.valuesRgb',
    },
    'radius': {
      datumType: 'f32',
      scalar: 'visual.radius',
    }
  }
} as const satisfies WPKBufferFormat<OrbiterUniform, Orbiter>;

export const bufferFormats = {
  uniforms,
  kepler,
  position,
  visual,
} as const;

export type OrbiterBufferFormats = typeof bufferFormats;
