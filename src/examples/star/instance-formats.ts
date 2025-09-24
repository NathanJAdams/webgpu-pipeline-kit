import { Camera, Color, Transformation } from '../..';

export type StarUniform = {
  camera: Camera;
};

export type Star = {
  visual: {
    color: Color;
    transformation: Transformation;
  };
};
