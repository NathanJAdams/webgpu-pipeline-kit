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
      setValueAtPath(instance, refPath, value);
    },
    extract(instance) {
      return getValueAtPathOfType(instance, refPath, 'number');
    },
  };
};
const ofNumberArray = <T>(numberArrayPath: string): WPKDatumExtractEmbedder<T, number[]> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating vec direct extractor from path '${numberArrayPath}'`);
  const refPath = toRefPath(numberArrayPath);
  return {
    embed(instance, value) {
      setValueAtPath(instance, refPath, value);
    },
    extract(instance) {
      const value = getValueAtPath(instance, refPath);
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
      refPaths.forEach((refPath, index) => setValueAtPath(instance, refPath, value[index]));
    },
    extract(instance) {
      const values = refPaths.map(refPath => getValueAtPathOfType(instance, refPath, 'number'));
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
      setValueAtPath(instance, refPath, value);
    },
    extract(instance) {
      return getValueAtPathOfType(instance, refPath, 'string');
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

const getValueAtPathWithIndex = (instance: any, refPath: WPKRefPath, index: number): any => {
  if (index === refPath.length - 1) {
    const key = refPath[index];
    const value = instance[key];
    if (value === undefined) {
      throw Error(`Did not find value at path ${JSON.stringify(refPath)}`);
    }
    logFuncs.lazyTrace(LOGGER, () => `Found value ${JSON.stringify(value)} at path ${JSON.stringify(refPath)}`);
    return value;
  }
  const key = refPath[index];
  const value = instance[key];
  if (value === undefined) {
    throw Error(`Did not find value at path ${JSON.stringify(refPath)}`);
  }
  return getValueAtPathWithIndex(value, refPath, index + 1);
};
const setValueAtPathWithIndex = (instance: any, refPath: WPKRefPath, value: any, index: number): void => {
  const key = refPath[index];
  if (index === refPath.length - 1) {
    instance[key] = value;
    return;
  }
  if (instance[key] === undefined) {
    instance[key] = (typeof refPath[index + 1] === 'string' ? {} : []);
  }
  setValueAtPathWithIndex(instance[key], refPath, value, index + 1);
};

export const getValueAtPathOfType = <TType extends keyof WPKPrimitiveMap>(instance: any, refPath: WPKRefPath, type: TType): WPKPrimitiveMap[TType] => {
  const value = getValueAtPathWithIndex(instance, refPath, 0);
  if (typeof value === type) {
    logFuncs.lazyTrace(LOGGER, () => `Found value ${JSON.stringify(value)} at path ${JSON.stringify(refPath)} of type '${type}'`);
    return value as WPKPrimitiveMap[TType];
  }
  throw Error(`Value ${JSON.stringify(value)} at path ${JSON.stringify(refPath)} was not of type '${type}'`);
};
export const getValueAtPath = (instance: any, refPath: WPKRefPath): any => getValueAtPathWithIndex(instance, refPath, 0);
export const setValueAtPath = (instance: any, refPath: WPKRefPath, value: any): any => setValueAtPathWithIndex(instance, refPath, value, 0);
