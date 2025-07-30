import { AnyFn, FunctionKeys } from './types';

type SafeCaller<T, K extends FunctionKeys<T>> = T[K] extends AnyFn
    ? (target: T, ...args: Parameters<T[K]>) => ReturnType<T[K]>
    : never;

export const callCreatorOf = <T>() =>
    <K extends FunctionKeys<T>>(methodName: K): SafeCaller<T, K> =>
        ((target: T, ...args: any[]) =>
          (target[methodName] as AnyFn)(...args)) as SafeCaller<T, K>;
