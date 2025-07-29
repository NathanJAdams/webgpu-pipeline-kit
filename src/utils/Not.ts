export type Not<T> = {
  [K in keyof T]?: never;
};
