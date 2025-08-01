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
  : TInstanceFormat extends []
  ? []
  : TInstanceFormat extends readonly [infer H, ...infer R]
  ? [WPKInstanceOf<H>, ...WPKInstanceOf<R>]
  : TInstanceFormat extends object
  ? { [K in keyof TInstanceFormat]: WPKInstanceOf<TInstanceFormat[K]> }
  : never;
