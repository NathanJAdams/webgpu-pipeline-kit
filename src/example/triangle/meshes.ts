import { factories, WPKMeshFactory, WPKMeshFactoryMap, WPKMeshParameters } from 'webgpu-pipeline-kit';

const ballParameters = {
  subdivisions: 'number',
} as const satisfies WPKMeshParameters;
const ball: WPKMeshFactory<typeof ballParameters> = {
  parameters: ballParameters,
  toMesh: (parameters) => factories.mesh.sphere(parameters.subdivisions),
};

const triangleParameters = {
  top: 'number',
} as const satisfies WPKMeshParameters;
const triangle: WPKMeshFactory<typeof triangleParameters> = {
  parameters: triangleParameters,
  toMesh: (parameters) => factories.mesh.triangle(parameters.top),
};

export const meshFactories = {
  ball,
  triangle,
} as const satisfies WPKMeshFactoryMap;

export type MeshFactories = typeof meshFactories;
