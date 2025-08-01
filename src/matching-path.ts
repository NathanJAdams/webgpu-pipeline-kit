import { Decrement } from './utils';

type WPKTupleIndexes<T extends readonly unknown[]> =
  Extract<keyof T, `${number}`> extends `${infer N extends number}`
  ? N
  : never;
type WPKIsExact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2)
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

export type WPKMatchingPath<TType, TMatchingType> = _WPKMatchingPath<TType, TMatchingType, '', 6>;
