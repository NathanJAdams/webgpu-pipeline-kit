import { Decrement } from './utils';

export type WPKPrimitiveMap = {
  boolean: boolean;
  string: string;
  number: number;
};

export type WPKInstanceFormat = _WPKInstanceFormat<6>;
export type WPKInstanceOf<TInstanceFormat> = _WPKInstanceOf<TInstanceFormat, 6>;

type _WPKInstanceFormat<Depth extends number> =
  Depth extends never
  ? never
  : keyof WPKPrimitiveMap
  | _WPKInstanceFormat<Decrement[Depth]>[]
  | { [key: string]: _WPKInstanceFormat<Decrement[Depth]> };

type _WPKInstanceOf<TInstanceFormat, TDepth extends number> =
  TInstanceFormat extends keyof WPKPrimitiveMap
  ? WPKPrimitiveMap[TInstanceFormat]
  : TInstanceFormat extends readonly [any, ...any[]]
  ? { [K in keyof TInstanceFormat]: _WPKInstanceOf<TInstanceFormat[K], Decrement[TDepth]> }
  : TInstanceFormat extends object
  ? { [K in keyof TInstanceFormat]: _WPKInstanceOf<TInstanceFormat[K], Decrement[TDepth]> }
  : never;
