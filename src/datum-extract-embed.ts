import { logFactory } from './logging';
import { WPKDatumExtractEmbedder, WPKPrimitiveMap, WPKRefPath } from './types';
import { logFuncs, stringFuncs } from './utils';

const LOGGER = logFactory.getLogger('data');

export const datumExtractEmbedFactory = {
  ofScalar: <T>(scalarPath: string): WPKDatumExtractEmbedder<T, number> => ofNumber(scalarPath),
  ofVector: <T>(vectorPath: string | string[]): WPKDatumExtractEmbedder<T, number[]> => {
    return Array.isArray(vectorPath)
      ? ofPathArray(vectorPath)
      : ofNumberArray(vectorPath);
  },
  ofMatrix: <T>(matrixPath: string | string[] | string[][]): WPKDatumExtractEmbedder<T, number[]> => {
    return Array.isArray(matrixPath)
      ? ofPathArray(matrixPath.flat())
      : ofNumberArray(matrixPath);
  },
  ofEntityId: <T>(entityIdPath: string): WPKDatumExtractEmbedder<T, string> => ofString(entityIdPath),
};

const ofNumber = <T>(numberPath: string): WPKDatumExtractEmbedder<T, number> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating number extractor from path '${numberPath}'`);
  const refPath = toRefPath(numberPath);
  return {
    embed(instance, value) {
      setValueOnInstanceAtPath(instance, refPath, value);
    },
    extract(instance) {
      return getValueOnInstanceAtPathOfType(instance, refPath, 'number');
    },
  };
};
const ofNumberArray = <T>(numberArrayPath: string): WPKDatumExtractEmbedder<T, number[]> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating vec direct extractor from path '${numberArrayPath}'`);
  const refPath = toRefPath(numberArrayPath);
  return {
    embed(instance, value) {
      setValueOnInstanceAtPath(instance, refPath, value);
    },
    extract(instance) {
      const value = getValueAtPath(instance, refPath, 0, false);
      if (Array.isArray(value)) {
        if (value.some(element => typeof element !== 'number')) {
          throw Error(`Some elements in array [${value.join(', ')}] are not number`);
        }
        logFuncs.lazyTrace(LOGGER, () => `Found array [${value.join(', ')}] at path '${numberArrayPath}'`);
        return value;
      }
      throw Error(`Value ${JSON.stringify(value)} at path ${refPath} is not an array`);
    },
  };
};
const ofPathArray = <T>(numberPaths: string[]): WPKDatumExtractEmbedder<T, number[]> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating vec split extractor from path '${JSON.stringify(numberPaths)}'`);
  const refPaths = numberPaths.map(toRefPath);
  return {
    embed(instance, value) {
      if (value.length !== refPaths.length) {
        throw Error(`Mismatch in lengths between array ${value.length} and ref paths ${refPaths.length}`);
      }
      refPaths.forEach((refPath, index) => setValueOnInstanceAtPath(instance, refPath, value[index]));
    },
    extract(instance) {
      const values = refPaths.map(refPath => getValueOnInstanceAtPathOfType(instance, refPath, 'number'));
      logFuncs.lazyTrace(LOGGER, () => `Found array [${values.join(', ')}] at paths [${numberPaths.join(', ')}]`);
      return values;
    },
  };
};
const ofString = <T>(stringPath: string): WPKDatumExtractEmbedder<T, string> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating string extractor from path '${stringPath}'`);
  const refPath = toRefPath(stringPath);
  return {
    embed(instance, value) {
      setValueOnInstanceAtPath(instance, refPath, value);
    },
    extract(instance) {
      return getValueOnInstanceAtPathOfType(instance, refPath, 'string');
    },
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
const getValueOnInstanceAtPathOfType = <T, TType extends keyof WPKPrimitiveMap>(instance: T, refPath: WPKRefPath, type: TType): WPKPrimitiveMap[TType] => {
  const value = getValueAtPath(instance, refPath, 0, false);
  if (typeof value === type) {
    logFuncs.lazyTrace(LOGGER, () => `Found value '${value}' at path '${refPath} of type ${type}'`);
    return value as WPKPrimitiveMap[TType];
  }
  throw Error(`Value ${JSON.stringify(value)} at path ${refPath} is not of type ${type}`);
};
const setValueOnInstanceAtPath = (instance: any, refPath: WPKRefPath, value: any): void => {
  const parentPath = refPath.slice(0, -1);
  const fieldPath = refPath[refPath.length - 1];
  const parent = getValueAtPath(instance, parentPath, 0, true);
  if (typeof parent !== 'object') {
    throw Error(`Cannot set value ${JSON.stringify(value)} on instance ${JSON.stringify(instance)} path ${parentPath} of type ${typeof parent}`);
  }
  logFuncs.lazyTrace(LOGGER, () => `Set value '${value}' at path '${refPath}'`);
  (parent as any)[fieldPath] = value;
};
const getValueAtPath = (input: any, refPath: WPKRefPath, pathIndex: number, ensurePath: boolean): unknown => {
  if (pathIndex > refPath.length) {
    throw Error(`Cannot use index ${pathIndex} larger than reference path. Path: ${refPath}. Input: ${JSON.stringify(input)}`);
  }
  if (pathIndex === refPath.length) {
    logFuncs.lazyTrace(LOGGER, () => `Found value ${input} at path ${JSON.stringify(refPath)}`);
    return input;
  }
  const indexValue = refPath[pathIndex];
  if (typeof indexValue === 'string') {
    const object = getValueAtPath(input[indexValue], refPath, pathIndex + 1, ensurePath);
    if (object !== undefined) {
      return object;
    } else if (ensurePath) {
      const newObject = {};
      input[indexValue] = newObject;
      return newObject;
    } else {
      throw Error(`Failed to find value for ${JSON.stringify(input)} at path ${indexValue}`);
    }
  } else if (typeof indexValue === 'number') {
    const array = getValueAtPath(input[indexValue], refPath, pathIndex + 1, ensurePath);
    if (array !== undefined) {
      return array;
    } else if (ensurePath) {
      const newArray: [] = [];
      input[indexValue] = newArray;
      return newArray;
    } else {
      throw Error(`Failed to find value for ${JSON.stringify(input)} at path ${indexValue}`);
    }
  } else {
    throw Error(`Cannot index using non-integer or string field ${indexValue}. Path: ${refPath}. Input: ${JSON.stringify(input)}`);
  }
};
