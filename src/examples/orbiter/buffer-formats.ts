import { WPKBufferFormat } from '../..';
import { Orbiter, OrbiterUniform } from './instance-formats';

export const uniforms = {
  bufferType: 'uniform',
  marshall: [{
    name: 'gameTime',
    datumType: 'f32',
    scalar: 'gameTime'
  }, {
    name: 'camera',
    datumType: 'mat4x4<f32>',
    matrix: 'camera.viewProjectionMatrix',
  }],
} as const satisfies WPKBufferFormat<OrbiterUniform, Orbiter>;

export const kepler = {
  bufferType: 'marshalled',
  marshall: [{
    name: 'primaryIndex',
    datumType: 'i32',
    entityIdKey: 'kepler.primaryId'
  }, {
    name: 'argumentOfPeriapsis',
    datumType: 'vec2<f32>',
    vector: 'kepler.argumentOfPeriapsis'
  }, {
    name: 'inclination',
    datumType: 'vec2<f32>',
    vector: 'kepler.inclination'
  }, {
    name: 'longitudeOfAscendingNode',
    datumType: 'vec2<f32>',
    vector: 'kepler.longitudeOfAscendingNode'
  }, {
    name: 'eccentricity',
    datumType: 'f32',
    scalar: 'kepler.eccentricity'
  }, {
    name: 'meanAnomaly',
    datumType: 'f32',
    scalar: 'kepler.meanAnomaly'
  }, {
    name: 'meanMotion',
    datumType: 'f32',
    scalar: 'kepler.meanMotion'
  }, {
    name: 'semiMajorAxis',
    datumType: 'f32',
    scalar: 'kepler.semiMajorAxis'
  }, {
    name: 'sqrt_OnePlusEccentricityOverOneMinusEccentricity',
    datumType: 'f32',
    scalar: 'kepler.sqrt_OnePlusEccentricityOverOneMinusEccentricity'
  }],
} as const satisfies WPKBufferFormat<OrbiterUniform, Orbiter>;

export const position = {
  bufferType: 'editable',
  layout: [{
    name: 'position',
    datumType: 'vec3<f32>',
  }]
} as const satisfies WPKBufferFormat<OrbiterUniform, Orbiter>;

export const visual = {
  bufferType: 'marshalled',
  marshall: [{
    name: 'color',
    datumType: 'vec3<f32>',
    vector: 'visual.color.valuesRgb',
  }, {
    name: 'radius',
    datumType: 'f32',
    scalar: 'visual.radius',
  }]
} as const satisfies WPKBufferFormat<OrbiterUniform, Orbiter>;

export const bufferFormats = {
  uniforms,
  kepler,
  position,
  visual,
} as const;

export type OrbiterBufferFormats = typeof bufferFormats;
