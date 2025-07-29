import { WGBKElementFormat, WGBKNamedFormat, WGBKScalarFormat, WGBKTupleFormat } from './element-formats';
import { TupleOf } from './utils';

export type WGBKInstanceFormat = Record<string, WGBKElementFormat>;

export type WGBKInstanceOf<T extends WGBKInstanceFormat> = {
  [K in keyof T]: T[K] extends WGBKScalarFormat
  ? number
  : T[K] extends WGBKTupleFormat
  ? TupleOf<number, T[K]>
  : T[K] extends WGBKNamedFormat
  ? { [Key in T[K][number]]: number }
  : never;
};
