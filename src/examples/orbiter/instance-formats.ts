import { Camera, Color } from '../..';

export type OrbiterUniform = {
  camera: Camera;
  gameTime: number;
};

export type Orbiter = {
  visual: {
    color: Color;
    radius: number;
  };
  kepler: {
    primaryId: string;
    semiMajorAxis: number;
    eccentricity: number;
    meanAnomaly: number;
    meanMotion: number;
    sqrt_OnePlusEccentricityOverOneMinusEccentricity: number;
    inclination: [number, number];
    argumentOfPeriapsis: [number, number];
    longitudeOfAscendingNode: [number, number];
  };
};
