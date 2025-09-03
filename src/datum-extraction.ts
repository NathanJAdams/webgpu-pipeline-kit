import { logFactory } from './logging';
import { WPKBufferFormatElementEntityIndex, WPKBufferFormatElementMatrix, WPKBufferFormatElementScalar, WPKBufferFormatElementVector, WPKDatumExtractor, WPKMatchingPathNumber, WPKMatchingPathVec2, WPKMatchingPathVec3, WPKMatchingPathVec4, WPKPrimitiveMap, WPKRefPath, WPKShaderMatrixUntyped, WPKShaderScalar, WPKShaderVectorUntyped } from './types';
import { logFuncs, stringFuncs } from './utils';

const LOGGER = logFactory.getLogger('data');

export const datumExtractorFactory = {
  ofScalar: <T>(format: WPKBufferFormatElementScalar<any, any>): WPKDatumExtractor<T, number> => ofNumber(format.scalar),
  ofVector: <T>(format: WPKBufferFormatElementVector<WPKShaderVectorUntyped, WPKShaderScalar, any>): WPKDatumExtractor<T, number[]> => {
    return Array.isArray(format.vector)
      ? ofPathArray(format.vector)
      : ofNumberArray(format.vector);
  },
  ofMatrix: <T>(format: WPKBufferFormatElementMatrix<WPKShaderMatrixUntyped, any>): WPKDatumExtractor<T, number[]> => {
    return Array.isArray(format.matrix)
      ? ofPathArray(format.matrix.flat())
      : ofNumberArray(format.matrix);
  },
  ofEntityId: <T>(format: WPKBufferFormatElementEntityIndex<T>): WPKDatumExtractor<T, string> => ofString(format.entityIdKey),
};

const ofNumber = <T>(path: string): WPKDatumExtractor<T, number> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating number extractor from path '${path}'`);
  const refPath = toRefPath(path);
  return (instance) => {
    const value = valueOnInstanceAtPathOfType(instance, refPath, 'number');
    logFuncs.lazyTrace(LOGGER, () => `Found value ${value} at path '${path}'`);
    return value;
  };
};
const ofNumberArray = <T>(path: WPKMatchingPathVec2<T> | WPKMatchingPathVec3<T> | WPKMatchingPathVec4<T>): WPKDatumExtractor<T, number[]> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating vec direct extractor from path '${path}'`);
  const refPath = toRefPath(path);
  return (instance) => {
    const value = valueAtPath(instance, refPath, 0);
    if (Array.isArray(value)) {
      if (value.some(element => typeof element !== 'number')) {
        throw Error(`Some elements in array [${value.join(', ')}] are not number`);
      }
      logFuncs.lazyTrace(LOGGER, () => `Found array [${value.join(', ')}] at path '${path}'`);
      return value;
    }
    throw Error(`Value ${JSON.stringify(value)} at path ${refPath} is not an array`);
  };
};
const ofPathArray = <T>(paths: WPKMatchingPathNumber<T>[]): WPKDatumExtractor<T, number[]> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating vec split extractor from path '${JSON.stringify(paths)}'`);
  const refPaths = paths.map(toRefPath);
  return (instance) => {
    const values = refPaths.map(refPath => valueOnInstanceAtPathOfType(instance, refPath, 'number'));
    logFuncs.lazyTrace(LOGGER, () => `Found array [${values.join(', ')}] at paths [${paths.join(', ')}]`);
    return values;
  };
};
const ofString = <T>(path: string): WPKDatumExtractor<T, string> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating string extractor from path '${path}'`);
  const refPath = toRefPath(path);
  return (instance) => {
    const value = valueAtPath(instance, refPath, 0);
    if (typeof value === 'string') {
      logFuncs.lazyTrace(LOGGER, () => `Found value '${value}' at path '${path}'`);
      return value;
    }
    throw Error(`Value ${JSON.stringify(value)} at path '${path}' is not a string`);
  };
};

const toRefPath = (path: string): WPKRefPath => {
  const parts = path.split('.');
  const refPath = parts.map(part => stringFuncs.canBePositiveInt(part)
    ? Number(part)
    : part);
  logFuncs.lazyTrace(LOGGER, () => `Converted path '${path}' to ref path ${JSON.stringify(refPath)}`);
  return refPath;
};
const valueAtPath = (input: any, refPath: WPKRefPath, pathIndex: number): unknown => {
  if (pathIndex > refPath.length) {
    throw Error(`Cannot use index ${pathIndex} larger than reference path. Path: ${refPath}. Input: ${JSON.stringify(input)}`);
  }
  if (pathIndex === refPath.length) {
    logFuncs.lazyTrace(LOGGER, () => `Found value ${input} at path ${JSON.stringify(refPath)}`);
    return input;
  }
  const indexValue = refPath[pathIndex];
  if (typeof input !== 'object' || input === null) {
    throw Error(`Cannot index field ${input} with index ${indexValue}. Path: ${refPath}. Input: ${JSON.stringify(input)}`);
  }
  if (typeof indexValue === 'string' || typeof indexValue === 'number') {
    return valueAtPath(input[indexValue], refPath, pathIndex + 1);
  }
  throw Error(`Cannot index using non-integer or string field ${indexValue}. Path: ${refPath}. Input: ${JSON.stringify(input)}`);
};
const valueOnInstanceAtPathOfType = <T, TType extends keyof WPKPrimitiveMap>(instance: T, refPath: WPKRefPath, type: TType): WPKPrimitiveMap[TType] => {
  const value = valueAtPath(instance, refPath, 0);
  if (typeof value === type) {
    return value as WPKPrimitiveMap[TType];
  }
  throw Error(`Value ${JSON.stringify(value)} at path ${refPath} is not a number`);
};
