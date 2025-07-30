import { WPKElementFormat, WPKNamedFormat, WPKScalarFormat, WPKTupleFormat } from './element-formats';
import { TupleOf } from './utils';

export type WPKInstanceFormat = Record<string, WPKElementFormat>;

export type WPKInstanceOf<T extends WPKInstanceFormat> = {
  [K in keyof T]: T[K] extends WPKScalarFormat
  ? number
  : T[K] extends WPKTupleFormat
  ? TupleOf<number, T[K]>
  : T[K] extends WPKNamedFormat
  ? { [Key in T[K][number]]: number }
  : never;
};
