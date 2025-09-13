import { Decrement } from '../utils';

//#region matching path
type WPKTupleIndexes<T extends readonly unknown[]> =
  Extract<keyof T, `${number}`> extends `${infer N extends number}`
  ? N
  : never;
type WPKIsExact<A, B> =
  [A] extends [B]
  ? [B] extends [A]
  ? true
  : false
  : false;
type WPKIsTuple<T> = T extends readonly unknown[]
  ? number extends T['length']
  ? false
  : true
  : false;
type _WPKMatchingPath<TType, TMatchingType, TPrefix extends string, TDepth extends number> =
  TDepth extends never
  ? never
  : TType extends readonly unknown[]
  ? WPKIsTuple<TType> extends true
  ? {
    [I in WPKTupleIndexes<TType>]:
    WPKIsExact<TType[I], TMatchingType> extends true
    ? `${TPrefix}${I}`
    : _WPKMatchingPath<TType[I], TMatchingType, `${TPrefix}${I}.`, Decrement[TDepth]>;
  }[WPKTupleIndexes<TType>]
  : never
  : TType extends object
  ? {
    [K in keyof TType & string]:
    WPKIsExact<TType[K], TMatchingType> extends true
    ? `${TPrefix}${K}`
    : _WPKMatchingPath<TType[K], TMatchingType, `${TPrefix}${K}.`, Decrement[TDepth]>
  }[keyof TType & string]
  : never;
export type WPKMatchingPath<TType, TMatchingType> = _WPKMatchingPath<TType, TMatchingType, '', 4>;
//#endregion

//#region matching paths
export type WPKMatchingPathNumber<T> = WPKMatchingPath<T, number>;
export type WPKMatchingPathString<T> = WPKMatchingPath<T, string>;
export type WPKMatchingPathVec2<T> =
  | WPKMatchingPath<T, [number, number]>
  | WPKMatchingPath<T, readonly [number, number]>
  ;
export type WPKMatchingPathVec3<T> =
  | WPKMatchingPath<T, [number, number, number]>
  | WPKMatchingPath<T, readonly [number, number, number]>
  ;
export type WPKMatchingPathVec4<T> =
  WPKMatchingPath<T, [number, number, number, number]>
  | WPKMatchingPath<T, readonly [number, number, number, number]>
  ;
export type WPKMatchingPathVec6<T> =
  WPKMatchingPath<T, [number, number, number, number, number, number]>
  | WPKMatchingPath<T, readonly [number, number, number, number, number, number]>
  ;
export type WPKMatchingPathVec8<T> =
  WPKMatchingPath<T, [number, number, number, number, number, number, number, number]>
  | WPKMatchingPath<T, readonly [number, number, number, number, number, number, number, number]>
  ;
export type WPKMatchingPathVec9<T> =
  WPKMatchingPath<T, [number, number, number, number, number, number, number, number, number]>
  | WPKMatchingPath<T, readonly [number, number, number, number, number, number, number, number, number]>
  ;
export type WPKMatchingPathVec12<T> =
  WPKMatchingPath<T, [number, number, number, number, number, number, number, number, number, number, number, number]>
  | WPKMatchingPath<T, readonly [number, number, number, number, number, number, number, number, number, number, number, number]>
  ;
export type WPKMatchingPathVec16<T> =
  WPKMatchingPath<T, [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]>
  | WPKMatchingPath<T, readonly [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]>
  ;
//#endregion

//#region scalars
export type WPKPathNumber<T> = WPKMatchingPathNumber<T>;
export type WPKPathString<T> = WPKMatchingPathString<T>;
//#endregion

//#region vectors
export type WPKPathVec2<T> =
  | WPKMatchingPathVec2<T>
  | [
    WPKMatchingPathNumber<T>,
    WPKMatchingPathNumber<T>,
  ]
  ;
export type WPKPathVec3<T> =
  | WPKMatchingPathVec3<T>
  | [
    WPKMatchingPathNumber<T>,
    WPKMatchingPathNumber<T>,
    WPKMatchingPathNumber<T>,
  ]
  ;
export type WPKPathVec4<T> =
  | WPKMatchingPathVec4<T>
  | [
    WPKMatchingPathNumber<T>,
    WPKMatchingPathNumber<T>,
    WPKMatchingPathNumber<T>,
    WPKMatchingPathNumber<T>,
  ]
  ;
//#endregion

//#region matrices 2xN
export type WPKPathMat2x2<T> =
  | WPKMatchingPathVec4<T>
  | [
    WPKMatchingPathVec2<T>,
    WPKMatchingPathVec2<T>,
  ]
  | [
    [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ]
  ]
  ;
export type WPKPathMat2x3<T> =
  | WPKMatchingPathVec6<T>
  | [
    WPKMatchingPathVec3<T>,
    WPKMatchingPathVec3<T>,
  ]
  | [
    [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ]
  ]
  ;
export type WPKPathMat2x4<T> =
  | WPKMatchingPathVec8<T>
  | [
    WPKMatchingPathVec4<T>,
    WPKMatchingPathVec4<T>,
  ]
  | [
    [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ]
  ]
  ;
//#endregion

//#region matrices 3xN
export type WPKPathMat3x2<T> =
  | WPKMatchingPathVec6<T>
  | [
    WPKMatchingPathVec2<T>,
    WPKMatchingPathVec2<T>,
    WPKMatchingPathVec2<T>,
  ]
  | [
    [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ]
  ]
  ;
export type WPKPathMat3x3<T> =
  | WPKMatchingPathVec9<T>
  | [
    WPKMatchingPathVec3<T>,
    WPKMatchingPathVec3<T>,
    WPKMatchingPathVec3<T>,
  ]
  | [
    [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ]
  ]
  ;
export type WPKPathMat3x4<T> =
  | WPKMatchingPathVec12<T>
  | [
    WPKMatchingPathVec4<T>,
    WPKMatchingPathVec4<T>,
    WPKMatchingPathVec4<T>,
  ]
  | [
    [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ]
  ]
  ;
//#endregion

//#region matrices 4xN
export type WPKPathMat4x2<T> =
  | WPKMatchingPathVec8<T>
  | [
    WPKMatchingPathVec2<T>,
    WPKMatchingPathVec2<T>,
    WPKMatchingPathVec2<T>,
    WPKMatchingPathVec2<T>,
  ]
  | [
    [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ]
  ]
  ;
export type WPKPathMat4x3<T> =
  | WPKMatchingPathVec12<T>
  | [
    WPKMatchingPathVec3<T>,
    WPKMatchingPathVec3<T>,
    WPKMatchingPathVec3<T>,
    WPKMatchingPathVec3<T>,
  ]
  | [
    [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ]
  ]
  ;
export type WPKPathMat4x4<T> =
  | WPKMatchingPathVec16<T>
  | [
    WPKMatchingPathVec4<T>,
    WPKMatchingPathVec4<T>,
    WPKMatchingPathVec4<T>,
    WPKMatchingPathVec4<T>,
  ]
  | [
    [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ], [
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
      WPKMatchingPathNumber<T>,
    ]
  ]
  ;
//#endregion
