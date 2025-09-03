import { WPKPathMat2x2, WPKPathMat2x3, WPKPathMat2x4, WPKPathMat3x2, WPKPathMat3x3, WPKPathMat3x4, WPKPathMat4x2, WPKPathMat4x3, WPKPathMat4x4, WPKPathNumber, WPKPathString, WPKPathVec2, WPKPathVec3, WPKPathVec4 } from './data-paths';
import { WPKShaderMatrixUntyped, WPKShaderScalar, WPKShaderScalarFloat, WPKShaderScalarSignedInt, WPKShaderStruct, WPKShaderStructEntry, WPKShaderVectorUntyped } from './structs';
import { NonEmptyArray } from '../utils';

export type WPKBufferFormatElementScalar<TScalar extends WPKShaderScalar, TPath> =
  & WPKShaderStructEntry<TScalar>
  & {
    scalar: TPath;
  };
export type WPKBufferFormatElementVector<TVector extends WPKShaderVectorUntyped, TComponentType extends WPKShaderScalar, TPath> =
  & WPKShaderStructEntry<`${TVector}<${TComponentType}>`>
  & {
    vector: TPath;
  };
export type WPKBufferFormatElementMatrix<TMatrix extends WPKShaderMatrixUntyped, TPath> =
  & WPKShaderStructEntry<`${TMatrix}<${WPKShaderScalarFloat}>`>
  & {
    matrix: TPath;
  };
export type WPKBufferFormatElementEntityIndex<T> =
  & WPKShaderStructEntry<WPKShaderScalarSignedInt>
  & {
    entityIdKey: WPKPathString<T>;
  };
export type WPKBufferFormatElementFloat<T> = WPKBufferFormatElementScalar<'f32', WPKPathNumber<T>>;
export type WPKBufferFormatElementSint<T> = WPKBufferFormatElementScalar<'i32', WPKPathNumber<T>>;
export type WPKBufferFormatElementUint<T> = WPKBufferFormatElementScalar<'u32', WPKPathNumber<T>>;
export type WPKBufferFormatElementVec2<T> = WPKBufferFormatElementVector<'vec2', WPKShaderScalar, WPKPathVec2<T>>;
export type WPKBufferFormatElementVec3<T> = WPKBufferFormatElementVector<'vec3', WPKShaderScalar, WPKPathVec3<T>>;
export type WPKBufferFormatElementVec4<T> = WPKBufferFormatElementVector<'vec4', WPKShaderScalar, WPKPathVec4<T>>;
export type WPKBufferFormatElementMat2x2<T> = WPKBufferFormatElementMatrix<'mat2x2', WPKPathMat2x2<T>>;
export type WPKBufferFormatElementMat2x3<T> = WPKBufferFormatElementMatrix<'mat2x3', WPKPathMat2x3<T>>;
export type WPKBufferFormatElementMat2x4<T> = WPKBufferFormatElementMatrix<'mat2x4', WPKPathMat2x4<T>>;
export type WPKBufferFormatElementMat3x2<T> = WPKBufferFormatElementMatrix<'mat3x2', WPKPathMat3x2<T>>;
export type WPKBufferFormatElementMat3x3<T> = WPKBufferFormatElementMatrix<'mat3x3', WPKPathMat3x3<T>>;
export type WPKBufferFormatElementMat3x4<T> = WPKBufferFormatElementMatrix<'mat3x4', WPKPathMat3x4<T>>;
export type WPKBufferFormatElementMat4x2<T> = WPKBufferFormatElementMatrix<'mat4x2', WPKPathMat4x2<T>>;
export type WPKBufferFormatElementMat4x3<T> = WPKBufferFormatElementMatrix<'mat4x3', WPKPathMat4x3<T>>;
export type WPKBufferFormatElementMat4x4<T> = WPKBufferFormatElementMatrix<'mat4x4', WPKPathMat4x4<T>>;

export type WPKBufferFormatElementUniform<T> =
  | WPKBufferFormatElementFloat<T>
  | WPKBufferFormatElementSint<T>
  | WPKBufferFormatElementUint<T>
  | WPKBufferFormatElementVec2<T>
  | WPKBufferFormatElementVec3<T>
  | WPKBufferFormatElementVec4<T>
  | WPKBufferFormatElementMat2x2<T>
  | WPKBufferFormatElementMat2x3<T>
  | WPKBufferFormatElementMat2x4<T>
  | WPKBufferFormatElementMat3x2<T>
  | WPKBufferFormatElementMat3x3<T>
  | WPKBufferFormatElementMat3x4<T>
  | WPKBufferFormatElementMat4x2<T>
  | WPKBufferFormatElementMat4x3<T>
  | WPKBufferFormatElementMat4x4<T>
  ;
export type WPKBufferFormatElementStorage<T> =
  | WPKBufferFormatElementFloat<T>
  | WPKBufferFormatElementSint<T>
  | WPKBufferFormatElementUint<T>
  | WPKBufferFormatElementVec2<T>
  | WPKBufferFormatElementVec3<T>
  | WPKBufferFormatElementVec4<T>
  | WPKBufferFormatElementEntityIndex<T>
  ;
export type WPKBufferFormatElement<T> =
  | WPKBufferFormatElementUniform<T>
  | WPKBufferFormatElementStorage<T>
  ;
export type WPKBufferFormatType = 'uniform' | 'editable' | 'marshalled';
export type WPKHasBufferFormatType<TBufferType extends WPKBufferFormatType> = {
  bufferType: TBufferType;
};
export type WPKBufferFormatMarshalled<T, TBufferType extends WPKBufferFormatType, F extends WPKBufferFormatElement<T>> = {
  bufferType: TBufferType;
  marshall: NonEmptyArray<F>;
};
export type WPKBufferFormatUniform<T> = WPKBufferFormatMarshalled<T, 'uniform', WPKBufferFormatElementUniform<T>>;
type WPKBufferFormatEntityLayout = WPKHasBufferFormatType<'editable'> & {
  layout: WPKShaderStruct;
};
export type WPKBufferFormatEntityMarshalled<T> = WPKBufferFormatMarshalled<T, 'marshalled', WPKBufferFormatElementStorage<T>>;
type WPKBufferFormatEntity<T> = WPKBufferFormatEntityLayout | WPKBufferFormatEntityMarshalled<T>;
export type WPKBufferFormat<TUniform, TEntity> =
  | WPKBufferFormatUniform<TUniform>
  | WPKBufferFormatEntity<TEntity>;
export type WPKBufferFormatMap<TUniform, TEntity> = Record<string, WPKBufferFormat<TUniform, TEntity>>;
export type WPKBufferFormatKey<TUniform, TEntity, TBufferFormats extends WPKBufferFormatMap<TUniform, TEntity>> = string & (keyof TBufferFormats);
