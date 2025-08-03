import { Decrement } from './utils';

export type WPKPrimitiveMap = {
  boolean: boolean;
  string: string;
  number: number;
};

export type WPKInstanceFormat = _WPKInstanceFormat<4>;
export type WPKInstanceOf<TFormat extends WPKInstanceFormat> = _WPKInstanceOf<TFormat, 4>;

type _WPKInstanceFormat<Depth extends number> =
  Depth extends never
  ? never
  : keyof WPKPrimitiveMap
  | _WPKInstanceFormat<Decrement[Depth]>[]
  | { [key: string]: _WPKInstanceFormat<Decrement[Depth]> };

type _WPKInstanceOf<TObj, TDepth extends number> =
  TObj extends keyof WPKPrimitiveMap
  ? WPKPrimitiveMap[TObj]
  : TObj extends readonly [any, ...any[]]
  ? { [K in keyof TObj]: _WPKInstanceOf<TObj[K], Decrement[TDepth]> }
  : TObj extends object
  ? { [K in keyof TObj]: _WPKInstanceOf<TObj[K], Decrement[TDepth]> }
  : never;
