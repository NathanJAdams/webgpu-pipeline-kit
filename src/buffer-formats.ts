import { WPKBufferFormatElement, WPKBufferFormatElementEntityIndex, WPKBufferFormatElementMatrix, WPKBufferFormatElementScalar, WPKBufferFormatElementVector, WPKBufferFormatMap, WPKShaderMatrixUntyped, WPKShaderScalar, WPKShaderVectorUntyped } from './types';

export const bufferFormatFuncs = {
  isEntityIndex: <T>(format: WPKBufferFormatElement<T>): format is WPKBufferFormatElementEntityIndex<T> => (format as WPKBufferFormatElementEntityIndex<T>).entityIdKey !== undefined,
  isScalar: <T>(format: WPKBufferFormatElement<T>): format is WPKBufferFormatElementScalar<any, any> => {
    return (format as WPKBufferFormatElementScalar<any, any>).scalar !== undefined;
  },
  isVector: <T, TComponentType extends WPKShaderScalar>(format: WPKBufferFormatElement<T>): format is WPKBufferFormatElementVector<WPKShaderVectorUntyped, TComponentType, any> => {
    const casted = format as WPKBufferFormatElementVector<WPKShaderVectorUntyped, WPKShaderScalar, any>;
    return (casted.vector !== undefined);
  },
  isMatrix: <T>(format: WPKBufferFormatElement<T>): format is WPKBufferFormatElementMatrix<WPKShaderMatrixUntyped, any> => {
    return (format as WPKBufferFormatElementMatrix<WPKShaderMatrixUntyped, any>).matrix !== undefined;
  },
  findFormatEntityIndexes: <TEntity>(bufferFormatMap: WPKBufferFormatMap<any, TEntity>): WPKBufferFormatElementEntityIndex<TEntity>[] => {
    const userFormatEntityIndexes: WPKBufferFormatElementEntityIndex<TEntity>[] = [];
    const paths = new Set<string>();
    for (const bufferFormat of Object.values(bufferFormatMap)) {
      if (bufferFormat.bufferType === 'marshalled') {
        for (const userFormat of bufferFormat.marshall) {
          if (bufferFormatFuncs.isEntityIndex(userFormat)) {
            if (!paths.has(userFormat.entityIdKey)) {
              userFormatEntityIndexes.push(userFormat);
            }
          }
        }
      }
    }
    return userFormatEntityIndexes;
  },
};
