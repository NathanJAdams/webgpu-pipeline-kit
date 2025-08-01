import { WPKIsTuple, WPKTupleIndexes } from './types';

export type WPKPrimitiveMap = {
  boolean: boolean;
  string: string;
  number: number;
};

export type WPKInstanceFormat =
  | keyof WPKPrimitiveMap
  | WPKInstanceFormat[]
  | { [key: string]: WPKInstanceFormat };

export type WPKInstanceOf<TInstanceFormat> =
  TInstanceFormat extends keyof WPKPrimitiveMap
  ? WPKPrimitiveMap[TInstanceFormat]
  : TInstanceFormat extends readonly unknown[]
  ? WPKIsTuple<TInstanceFormat> extends true
  ? { [I in WPKTupleIndexes<TInstanceFormat>]: WPKInstanceOf<TInstanceFormat[I]> }
  : never
  : TInstanceFormat extends object
  ? { [K in keyof TInstanceFormat]: WPKInstanceOf<TInstanceFormat[K]> }
  : never;
