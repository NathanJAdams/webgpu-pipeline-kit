import { factories } from '../..';

const ballParameters = {
  subdivisions: 'number',
} as const;
const ball = factories.meshTemplate.of(ballParameters, (params) => factories.mesh.sphere(params.subdivisions));

const triangleParameters = {
  top: 'number',
} as const;
const triangle = factories.meshTemplate.of(triangleParameters, (params) => factories.mesh.triangle(params.top));

export const meshTemplates = {
  ball,
  triangle,
} as const;

export type MeshTemplates = typeof meshTemplates;
