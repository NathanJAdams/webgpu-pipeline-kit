import { Vec3 } from '../utils';

//#region mesh
export type WPKVertices = Vec3[];
export type WPKIndices = Vec3[];
export type WPKMesh = {
  vertices: WPKVertices;
  indices: WPKIndices;
  topology: GPUPrimitiveTopology;
  winding: GPUFrontFace;
};
//#endregion

//#region template
export type WPKPrimitiveMap = {
  boolean: boolean;
  string: string;
  number: number;
};
export type WPKMeshParametersDeclaration = Record<string, keyof WPKPrimitiveMap>;
export type WPKMeshParameters<TDeclaration extends WPKMeshParametersDeclaration> = {
  [K in keyof TDeclaration]: WPKPrimitiveMap[TDeclaration[K]];
};
export type WPKMeshTemplateCreator<TParameters extends WPKMeshParametersDeclaration> = (parameters: WPKMeshParameters<TParameters>) => WPKMesh;
export type WPKMeshTemplate<TParameters extends WPKMeshParametersDeclaration> = {
  parameters: TParameters;
  toMesh: WPKMeshTemplateCreator<TParameters>;
};
export type WPKMeshTemplateMap = Record<string, WPKMeshTemplate<any>>;
//#endregion
