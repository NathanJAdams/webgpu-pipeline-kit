import { isUserFormatVec2, isUserFormatVec3, isUserFormatVec4, WPKMatchingPathNumber, WPKMatchingPathVec2, WPKMatchingPathVec3, WPKMatchingPathVec4, WPKUserFormatBoolean, WPKUserFormatEntityIndex, WPKUserFormatNumber, WPKUserFormatVec2, WPKUserFormatVec3, WPKUserFormatVec4 } from './buffer-formats';
import { WPKInstanceFormat, WPKInstanceOf, WPKPrimitiveMap } from './instance';
import { logFactory } from './logging';
import { logFuncs, stringFuncs } from './utils';

type WPKRefPath = Array<(string | number)>;

export type WPKDatumExtractor<TFormat extends WPKInstanceFormat, TValue> = (instance: WPKInstanceOf<TFormat>) => TValue;

const LOGGER = logFactory.getLogger('data');

export const datumExtractorFactory = {
  ofBoolean: <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormatBoolean<TEntityFormat>): WPKDatumExtractor<TEntityFormat, boolean> => ofBoolean(userFormat.boolean),
  ofNumber: <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormatNumber<TEntityFormat>): WPKDatumExtractor<TEntityFormat, number> => ofNumber(userFormat.number),
  ofVec: <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormatVec2<TEntityFormat> | WPKUserFormatVec3<TEntityFormat> | WPKUserFormatVec4<TEntityFormat>): WPKDatumExtractor<TEntityFormat, number[]> => {
    if (isUserFormatVec2(userFormat)) {
      return Array.isArray(userFormat.vec2)
        ? ofVecSplit(userFormat.vec2)
        : ofVecDirect(userFormat.vec2);
    } else if (isUserFormatVec3(userFormat)) {
      return Array.isArray(userFormat.vec3)
        ? ofVecSplit(userFormat.vec3)
        : ofVecDirect(userFormat.vec3);
    } else if (isUserFormatVec4(userFormat)) {
      return Array.isArray(userFormat.vec4)
        ? ofVecSplit(userFormat.vec4)
        : ofVecDirect(userFormat.vec4);
    }
    throw Error(`Cannot create vec extractor from ${JSON.stringify(userFormat)}`);
  },
  ofEntityId: <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormatEntityIndex<TEntityFormat>): WPKDatumExtractor<TEntityFormat, string> => ofString(userFormat.entityIdKey),
};

const ofBoolean = <TEntityFormat extends WPKInstanceFormat>(path: string): WPKDatumExtractor<TEntityFormat, boolean> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating boolean extractor from path '${path}'`);
  const refPath = toRefPath(path);
  return (instance) => {
    const value = valueAtPath(instance, refPath, 0);
    if (typeof value === 'boolean') {
      logFuncs.lazyTrace(LOGGER, () => `Found value ${value} at path '${path}'`);
      return value;
    }
    throw Error(`Value ${JSON.stringify(value)} at path '${path}' is not a boolean`);
  };
};
const ofNumber = <TEntityFormat extends WPKInstanceFormat>(path: string): WPKDatumExtractor<TEntityFormat, number> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating number extractor from path '${path}'`);
  const refPath = toRefPath(path);
  return (instance) => {
    const value = valueOnInstanceAtPathOfType(instance, refPath, 'number');
    logFuncs.lazyTrace(LOGGER, () => `Found value ${value} at path '${path}'`);
    return value;
  };
};
const ofVecDirect = <TEntityFormat extends WPKInstanceFormat>(path: WPKMatchingPathVec2<TEntityFormat> | WPKMatchingPathVec3<TEntityFormat> | WPKMatchingPathVec4<TEntityFormat>): WPKDatumExtractor<TEntityFormat, number[]> => {
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
const ofVecSplit = <TEntityFormat extends WPKInstanceFormat>(paths: WPKMatchingPathNumber<TEntityFormat>[]): WPKDatumExtractor<TEntityFormat, number[]> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating vec split extractor from path '${JSON.stringify(paths)}'`);
  const refPaths = paths.map(toRefPath);
  return (instance) => {
    const values = refPaths.map(refPath => valueOnInstanceAtPathOfType(instance, refPath, 'number'));
    logFuncs.lazyTrace(LOGGER, () => `Found array [${values.join(', ')}] at paths [${paths.join(', ')}]`);
    return values;
  };
};
const ofString = <TEntityFormat extends WPKInstanceFormat>(path: string): WPKDatumExtractor<TEntityFormat, string> => {
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
const valueOnInstanceAtPathOfType = <TEntityFormat extends WPKInstanceFormat, TType extends keyof WPKPrimitiveMap>(instance: WPKInstanceOf<TEntityFormat>, refPath: WPKRefPath, type: TType): WPKPrimitiveMap[TType] => {
  const value = valueAtPath(instance, refPath, 0);
  if (typeof value === type) {
    return value as WPKPrimitiveMap[TType];
  }
  throw Error(`Value ${JSON.stringify(value)} at path ${refPath} is not a number`);
};
