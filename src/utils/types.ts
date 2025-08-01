export type NonEmptyArray<T> = [T, ...T[]];

export type Decrement = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

export type ArrayIndex<N extends number, Result extends number[] = []> = Result['length'] extends N
  ? Result[number]
  : ArrayIndex<N, [...Result, Result['length']]>;

export type ExactlyOne<T> = {
  [K in keyof T]: {
    [P in K]: T[P];
  } & {
    [P in Exclude<keyof T, K>]?: never;
  }
}[keyof T];

export type TupleOf<T, Ns extends number> = Ns extends Ns
  ? _TupleOfWithRest<T, Ns>
  : never;

type _TupleOfWithRest<T, N extends number, R extends unknown[] = []> = R['length'] extends N
  ? R
  : _TupleOfWithRest<T, N, [...R, T]>;

export type AnyFn = (...args: any[]) => any;
export type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends AnyFn
  ? K
  : never
}[keyof T];
