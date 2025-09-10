import { ValueSlices } from '../utils';

//#region uniform and entity
export type WPKCacheMutable<T, TKey> = {
  mutate: (id: TKey, element: T) => void;
};
export type WPKCacheResizeable<T> = {
  add: (element: T) => string;
  remove: (id: string) => void;
  idOf: (index: number) => string | undefined;
  indexOf: (id: string) => number;
};
export type WPKUniformCache<TUniform, TMutable extends boolean> =
  & {
    isMutable: TMutable;
    isDirty: () => boolean;
    get: () => TUniform;
  }
  & (
    TMutable extends true
    ? {
      mutate: (element: TUniform) => void;
    }
    : object
  );
export type WPKEntityCache<TEntity, TMutable extends boolean, TResizeable extends boolean> =
  & {
    isMutable: TMutable;
    isResizeable: TResizeable;
    count: () => number;
    isDirty: () => boolean;
    calculateChanges: () => ValueSlices<TEntity[]>;
  }
  & (TMutable extends true
    ? WPKCacheMutable<TEntity, TResizeable extends true ? string : number>
    : object
  )
  & (
    TResizeable extends true
    ? WPKCacheResizeable<TEntity>
    : object
  );
//#endregion

//#region packed
export type IdGetter<T> = (element: T) => string;
export type PackedCache<T, TMutable extends boolean> =
  & {
    isMutable: () => boolean;
    isDirty: () => boolean;
    count: () => number;
    add: (instance: T) => string;
    remove: (id: string) => void;
    idOf: (index: number) => string | undefined;
    indexOf: (id: string) => number;
    pack: () => ValueSlices<T[]>;
  }
  & (
    TMutable extends true
    ? {
      mutate: (id: string, instance: T) => void;
    }
    : object
  );
//#endregion
