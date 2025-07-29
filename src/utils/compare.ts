export type Comparator<T> = (a: T, b: T) => number;
export type Equality<T> = (a: T, b: T) => boolean;

export const Comparators = {
  ofDoubleEquals: <T>(): Equality<T> => (a, b) => a == b,
  ofTripleEquals: <T>(): Equality<T> => (a, b) => a === b,
};
