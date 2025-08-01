import { Decrement } from './utils';

export type WPKPrimitiveMap = {
  boolean: boolean;
  string: string;
  number: number;
};

export type WPKInstanceFormat =
  | keyof WPKPrimitiveMap
  | WPKInstanceFormat[]
  | { [key: string]: WPKInstanceFormat };

export type WPKInstanceOf<TInstanceFormat> = _WPKInstanceOf<TInstanceFormat, 4>;

type _WPKInstanceOf<TInstanceFormat, TDepth extends number> =
  TInstanceFormat extends keyof WPKPrimitiveMap
  ? WPKPrimitiveMap[TInstanceFormat]
  : TInstanceFormat extends readonly [any, ...any[]]
  ? { [K in keyof TInstanceFormat]: _WPKInstanceOf<TInstanceFormat[K], Decrement[TDepth]> }
  : TInstanceFormat extends object
  ? { [K in keyof TInstanceFormat]: _WPKInstanceOf<TInstanceFormat[K], Decrement[TDepth]> }
  : never;
