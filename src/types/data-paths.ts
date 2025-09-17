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
export type WPKVec2 = [number, number];
export type WPKVec3 = [number, number, number];
export type WPKVec4 = [number, number, number, number];
export type WPKVec6 = [number, number, number, number, number, number];
export type WPKVec8 = [number, number, number, number, number, number, number, number];
export type WPKVec9 = [number, number, number, number, number, number, number, number, number];
export type WPKVec12 = [number, number, number, number, number, number, number, number, number];
export type WPKVec16 = [number, number, number, number, number, number, number, number, number];
//#endregion

//#region scalars
export type WPKPathNumber<T> = WPKMatchingPathNumber<T>;
export type WPKPathString<T> = WPKMatchingPathString<T>;
//#endregion

//#region vectors
export type WPKPathVec2<T> =
  | WPKMatchingPath<T, WPKVec2>
  | [
    WPKMatchingPathNumber<T>,
    WPKMatchingPathNumber<T>,
  ]
  ;
export type WPKPathVec3<T> =
  | WPKMatchingPath<T, WPKVec3>
  | [
    WPKMatchingPathNumber<T>,
    WPKMatchingPathNumber<T>,
    WPKMatchingPathNumber<T>,
  ]
  ;
export type WPKPathVec4<T> =
  | WPKMatchingPath<T, WPKVec4>
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
  | WPKMatchingPath<T, WPKVec4>
  | WPKMatchingPath<T, [WPKVec2, WPKVec2]>
  | [
    WPKMatchingPath<T, WPKVec2>,
    WPKMatchingPath<T, WPKVec2>,
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
  | WPKMatchingPath<T, WPKVec6>
  | WPKMatchingPath<T, [WPKVec3, WPKVec3]>
  | [
    WPKMatchingPath<T, WPKVec3>,
    WPKMatchingPath<T, WPKVec3>,
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
  | WPKMatchingPath<T, WPKVec8>
  | WPKMatchingPath<T, [WPKVec4, WPKVec4]>
  | [
    WPKMatchingPath<T, WPKVec4>,
    WPKMatchingPath<T, WPKVec4>,
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
  | WPKMatchingPath<T, WPKVec6>
  | WPKMatchingPath<T, [WPKVec2, WPKVec2, WPKVec2]>
  | [
    WPKMatchingPath<T, WPKVec2>,
    WPKMatchingPath<T, WPKVec2>,
    WPKMatchingPath<T, WPKVec2>,
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
  | WPKMatchingPath<T, WPKVec9>
  | WPKMatchingPath<T, [WPKVec3, WPKVec3, WPKVec3]>
  | [
    WPKMatchingPath<T, WPKVec3>,
    WPKMatchingPath<T, WPKVec3>,
    WPKMatchingPath<T, WPKVec3>,
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
  | WPKMatchingPath<T, WPKVec12>
  | WPKMatchingPath<T, [WPKVec4, WPKVec4, WPKVec4]>
  | [
    WPKMatchingPath<T, WPKVec4>,
    WPKMatchingPath<T, WPKVec4>,
    WPKMatchingPath<T, WPKVec4>,
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
  | WPKMatchingPath<T, WPKVec8>
  | WPKMatchingPath<T, [WPKVec2, WPKVec2, WPKVec2, WPKVec2]>
  | [
    WPKMatchingPath<T, WPKVec2>,
    WPKMatchingPath<T, WPKVec2>,
    WPKMatchingPath<T, WPKVec2>,
    WPKMatchingPath<T, WPKVec2>,
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
  | WPKMatchingPath<T, WPKVec12>
  | WPKMatchingPath<T, [WPKVec3, WPKVec3, WPKVec3, WPKVec3]>
  | [
    WPKMatchingPath<T, WPKVec3>,
    WPKMatchingPath<T, WPKVec3>,
    WPKMatchingPath<T, WPKVec3>,
    WPKMatchingPath<T, WPKVec3>,
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
  | WPKMatchingPath<T, WPKVec16>
  | WPKMatchingPath<T, [WPKVec4, WPKVec4, WPKVec4, WPKVec4]>
  | [
    WPKMatchingPath<T, WPKVec4>,
    WPKMatchingPath<T, WPKVec4>,
    WPKMatchingPath<T, WPKVec4>,
    WPKMatchingPath<T, WPKVec4>,
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
