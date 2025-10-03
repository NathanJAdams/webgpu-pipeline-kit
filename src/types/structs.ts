//#region data
export type WPKShaderDimensionMap = {
  '2': 2;
  '3': 3;
  '4': 4;
}
export type WPKShaderDimension = 2 | 3 | 4;
export type WPKShaderScalarSignedInt = 'i32';
export type WPKShaderScalarUnsignedInt = 'u32';
export type WPKShaderScalarFloat = 'f32';
export type WPKShaderScalar = WPKShaderScalarSignedInt | WPKShaderScalarUnsignedInt | WPKShaderScalarFloat;
export type WPKShaderVectorOfDimensionType<TDimension extends WPKShaderDimension, TComponentType extends WPKShaderScalar> = `vec${TDimension}<${TComponentType}>`;
export type WPKShaderVectorUntyped = `vec${WPKShaderDimension}`;
export type WPKShaderVector = `${WPKShaderVectorUntyped}<${WPKShaderScalar}>`;
export type WPKShaderMatrixOfDimensionType<TColumns extends WPKShaderDimension, TRows extends WPKShaderDimension, TComponentType extends WPKShaderScalar> = `mat${TColumns}x${TRows}<${TComponentType}>`;
export type WPKShaderMatrixUntyped = `mat${WPKShaderDimension}x${WPKShaderDimension}`;
export type WPKShaderMatrix = `${WPKShaderMatrixUntyped}<f32>`;
export type WPKShaderDatumType = WPKShaderScalar | WPKShaderVector | WPKShaderMatrix;
//#endregion

//#region structs
export type WPKHasDatumType<TDatumType extends WPKShaderDatumType = WPKShaderDatumType> = {
  datumType: TDatumType;
};
export type WPKShaderStruct = Record<string, WPKHasDatumType>;
//#endregion
