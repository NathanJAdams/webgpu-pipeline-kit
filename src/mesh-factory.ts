import { WPKInstanceOf, WPKPrimitiveMap } from './instance';
import { WPKMesh } from './meshes';

export type WPKMeshParameters = Record<string, keyof WPKPrimitiveMap>;
export type WPKMeshFactory<TParameters extends WPKMeshParameters> = {
  parameters: TParameters;
  toMesh: (parameters: WPKInstanceOf<TParameters>) => WPKMesh;
};
export type WPKMeshFactoryMap = Record<string, WPKMeshFactory<any>>;
