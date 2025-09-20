import { Decrement } from '../utils';
import { WPKShaderDimension } from './structs';

//#region matching path
type WPKDeepReadonly<T> =
  T extends Function
  ? T
  : T extends readonly any[]
  ? { readonly [K in keyof T]: WPKDeepReadonly<T[K]> }
  : T extends object
  ? { readonly [K in keyof T]: WPKDeepReadonly<T[K]> }
  : T
  ;
type WPKTupleIndexes<T extends unknown[]> =
  Exclude<keyof T, keyof any[]> extends infer Keys
  ? Keys extends `${infer N extends number}`
  ? N
  : never
  : never
  ;
type WPKHasExactInUnionIgnoringReadonly<TTestType, TRequiredType> =
  WPKDeepReadonly<TTestType> extends WPKDeepReadonly<TRequiredType>
  ? WPKDeepReadonly<TRequiredType> extends WPKDeepReadonly<TTestType>
  ? true
  : false
  : false
  ;
type _WPKMatchingPath<TTestType, TRequiredType, TPrefix extends string, TDepth extends number> =
  TDepth extends never
  ? never
  : TTestType extends unknown[]
  ? number extends TTestType['length']
  ? never
  : {
    [I in WPKTupleIndexes<TTestType>]:
    true extends WPKHasExactInUnionIgnoringReadonly<TTestType[I], TRequiredType>
    ? `${TPrefix}${I}`
    : _WPKMatchingPath<TTestType[I], TRequiredType, `${TPrefix}${I}.`, Decrement[TDepth]>;
  }[WPKTupleIndexes<TTestType>]
  : TTestType extends object
  ? TTestType extends Function
  ? never
  : {
    [K in keyof TTestType & string]:
    true extends WPKHasExactInUnionIgnoringReadonly<TTestType[K], TRequiredType>
    ? `${TPrefix}${K}`
    : _WPKMatchingPath<TTestType[K], TRequiredType, `${TPrefix}${K}.`, Decrement[TDepth]>
  }[keyof TTestType & string]
  : never
  ;
type WPKMatchingPath<TTestType, TRequiredType> = _WPKMatchingPath<TTestType, TRequiredType, '', 4>;
//#endregion

//#region path helpers
type WPKTupleOf<TElement, TCount extends WPKShaderDimension> =
  TCount extends 2
  ? [TElement, TElement]
  : TCount extends 3
  ? [TElement, TElement, TElement]
  : TCount extends 4
  ? [TElement, TElement, TElement, TElement]
  : never
  ;
type WPKFlatten<T extends readonly unknown[][]> =
  T extends [infer First extends readonly unknown[], ...infer Rest extends readonly unknown[][]]
  ? [...First, ...WPKFlatten<Rest>]
  : []
  ;
type WPKFlatVectorOf<TElement, TColumns extends WPKShaderDimension, TRows extends WPKShaderDimension> = WPKFlatten<WPKTupleOf<WPKTupleOf<TElement, TRows>, TColumns>>;
type WPKPathVector<T, TCount extends WPKShaderDimension> =
  | WPKMatchingPath<T, WPKTupleOf<number, TCount>>
  | WPKTupleOf<WPKPathNumber<T>, TCount>
  ;
type WPKPathMatrix<T, TColumns extends WPKShaderDimension, TRows extends WPKShaderDimension> =
  | WPKMatchingPath<T, WPKFlatVectorOf<number, TColumns, TRows>>
  | WPKMatchingPath<T, WPKTupleOf<WPKTupleOf<number, TRows>, TColumns>>
  | WPKTupleOf<WPKMatchingPath<T, WPKTupleOf<number, TRows>>, TColumns>
  | WPKTupleOf<WPKTupleOf<WPKPathNumber<T>, TRows>, TColumns>
  ;
//#endregion

//#region paths
export type WPKPathNumber<T> = WPKMatchingPath<T, number>;
export type WPKPathString<T> = WPKMatchingPath<T, string>;

export type WPKPathVec2<T> = WPKPathVector<T, 2>;
export type WPKPathVec3<T> = WPKPathVector<T, 3>;
export type WPKPathVec4<T> = WPKPathVector<T, 4>;

export type WPKPathMat2x2<T> = WPKPathMatrix<T, 2, 2>;
export type WPKPathMat2x3<T> = WPKPathMatrix<T, 2, 3>;
export type WPKPathMat2x4<T> = WPKPathMatrix<T, 2, 4>;
export type WPKPathMat3x2<T> = WPKPathMatrix<T, 3, 2>;
export type WPKPathMat3x3<T> = WPKPathMatrix<T, 3, 3>;
export type WPKPathMat3x4<T> = WPKPathMatrix<T, 3, 4>;
export type WPKPathMat4x2<T> = WPKPathMatrix<T, 4, 2>;
export type WPKPathMat4x3<T> = WPKPathMatrix<T, 4, 3>;
export type WPKPathMat4x4<T> = WPKPathMatrix<T, 4, 4>;
//#endregion
