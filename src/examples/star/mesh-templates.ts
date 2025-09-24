import { factories } from '../..';

const sphereParameters = {
  subdivisions: 'number',
} as const;
const sphere = factories.meshTemplate.of(sphereParameters, (params) => factories.mesh.sphere(params.subdivisions));

export const meshTemplates = {
  sphere,
} as const;

export type StarMeshTemplates = typeof meshTemplates;
