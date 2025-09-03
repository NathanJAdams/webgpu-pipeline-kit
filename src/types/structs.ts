import { NonEmptyArray } from '../utils';

//#region data
export type WPKShaderDimension = 2 | 3 | 4;
export type WPKShaderScalarSignedInt = 'i32';
export type WPKShaderScalarUnsignedInt = 'u32';
export type WPKShaderScalarFloat = 'f32';
export type WPKShaderScalar = WPKShaderScalarSignedInt | WPKShaderScalarUnsignedInt | WPKShaderScalarFloat;
export type WPKShaderVectorUntyped = `vec${WPKShaderDimension}`;
export type WPKShaderVector = `${WPKShaderVectorUntyped}<${WPKShaderScalar}>`;
export type WPKShaderMatrixUntyped = `mat${WPKShaderDimension}x${WPKShaderDimension}`;
export type WPKShaderMatrix = `${WPKShaderMatrixUntyped}<f32>`;
export type WPKShaderDatumType = WPKShaderScalar | WPKShaderVector | WPKShaderMatrix;
//#endregion

//#region structs
export type WPKShaderStructEntry<TDatumType extends WPKShaderDatumType = WPKShaderDatumType> = {
  name: string;
  datumType: TDatumType;
};
export type WPKShaderStruct = NonEmptyArray<WPKShaderStructEntry>;
export type WPKShaderStructMap = Record<string, WPKShaderStruct>;
export type WPKShaderStorageAccessMode = 'read' | 'read_write';
export type WPKShaderStructRef<TStructMap extends WPKShaderStructMap> = string & keyof TStructMap;
//#endregion
