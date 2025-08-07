import { isUserFormatEntityIndex, isUserFormatScalar, isUserFormatVec2, isUserFormatVec3, isUserFormatVec4, WPKFormatMarshall, WPKPrimitive, WPKUserFormat } from './buffer-formats';
import { WPKEntityCache } from './cache';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { getLogger, lazyDebug, lazyTrace, lazyWarn } from './logging';
import { strideFuncs } from './strides';
import { callCreatorOf, floatFuncs, stringFuncs } from './utils';

type WPKDataBridge<TFormat extends WPKInstanceFormat> = (offset: number, instance: WPKInstanceOf<TFormat>, dataView: DataView) => void;
type WPKDataExtractor<TFormat extends WPKInstanceFormat> = {
  extract: (instances: WPKInstanceOf<TFormat>[]) => ArrayBuffer;
};
type WPKDatumSetter = (target: DataView, offset: number, value: number, littleEndian: boolean) => void;

const LOGGER = getLogger('data');

const createDatumSetters = (): Map<WPKPrimitive, WPKDatumSetter> => {
  const dataViewCallCreator = callCreatorOf<DataView>();
  const map = new Map<WPKPrimitive, WPKDatumSetter>();
  const setInt8 = dataViewCallCreator('setInt8');
  const setUint8 = dataViewCallCreator('setUint8');
  const setInt16 = dataViewCallCreator('setInt16');
  const setUint16 = dataViewCallCreator('setUint16');
  const setInt32 = dataViewCallCreator('setInt32');
  const setUint32 = dataViewCallCreator('setUint32');
  const setFloat32 = dataViewCallCreator('setFloat32');
  map.set('sint8', setInt8);
  map.set('snorm8', setInt8);
  map.set('uint8', setUint8);
  map.set('unorm8', setUint8);
  map.set('sint16', setInt16);
  map.set('snorm16', setInt16);
  map.set('uint16', setUint16);
  map.set('unorm16', setUint16);
  map.set('sint32', setInt32);
  map.set('uint32', setUint32);
  map.set('float16', (target: DataView, offset: number, value: number, littleEndian: boolean) => setUint16(target, offset, floatFuncs.float32ToFloat16(value), littleEndian));
  map.set('float32', setFloat32);
  return map;
};

const datumSetters = createDatumSetters();

const LITTLE_ENDIAN = true;

export const dataExtractorFactory = {
  of: <TFormat extends WPKInstanceFormat>(marshallFormats: WPKFormatMarshall<TFormat, any>, entityCache?: WPKEntityCache<TFormat, any, any>): WPKDataExtractor<TFormat> => {
    lazyDebug(LOGGER, () => 'Create data extractor');
    let totalStride = 0;
    const dataBridges: WPKDataBridge<TFormat>[] = [];
    for (const userFormat of marshallFormats) {
      lazyTrace(LOGGER, () => `Create ref from user format ${JSON.stringify(userFormat)}`);
      const userFormatRef = toMarshalledRef(userFormat, entityCache);
      const { datumType } = userFormat;
      const datumStride = strideFuncs.ofVertexFormat(datumType);
      const stride = userFormatRef.datumCount * datumStride;
      const datumSetter = datumSetters.get(datumType);
      if (datumSetter === undefined) {
        throw Error(`Cannot set datum of type ${datumType}`);
      }
      const datumOffset = totalStride;
      dataBridges.push((offset, instance, dataView) => {
        const values = userFormatRef.valuesOf(instance);
        if (typeof values === 'number') {
          lazyTrace(LOGGER, () => `Setting value ${values} at offset ${offset + datumOffset}`);
          datumSetter(dataView, offset + datumOffset, values, LITTLE_ENDIAN);
        } else {
          for (const value of values) {
            lazyTrace(LOGGER, () => `Setting value ${value} at offset ${offset + datumOffset}`);
            datumSetter(dataView, offset + datumOffset, value, LITTLE_ENDIAN);
            offset += datumStride;
          }
        }
      });
      totalStride += stride;
    }
    return {
      extract(instances) {
        lazyDebug(LOGGER, () => `Extract data from ${instances.length} instances`);
        const totalSize = instances.length * totalStride;
        lazyTrace(LOGGER, () => `Creating data view to hold extracted instance data of size ${totalSize}`);
        const buffer = new ArrayBuffer(totalSize);
        const dataView = new DataView(buffer);
        instances.forEach((instance, index) => {
          lazyTrace(LOGGER, () => `Extracting data from instance ${JSON.stringify(instance)}`);
          dataBridges.forEach((extractor) => extractor(index * totalStride, instance, dataView));
        });
        return buffer;
      },
    };
  },
};

type WPKUserFormatRef<TFormat extends WPKInstanceFormat> = {
  datumCount: number;
  valuesOf: (instance: WPKInstanceOf<TFormat>) => number | number[];
};
type WPKRefPath = Array<(string | number)>;

const toMarshalledRef = <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TEntityFormat, any>, entityCache?: WPKEntityCache<TEntityFormat, any, any>): WPKUserFormatRef<TEntityFormat> => {
  if (isUserFormatScalar(userFormat)) {
    return ofScalar(userFormat.scalar);
  } else if (isUserFormatVec2(userFormat)) {
    return Array.isArray(userFormat.vec2)
      ? ofVecSplit(userFormat.vec2)
      : ofVecDirect(userFormat.vec2, 2);
  } else if (isUserFormatVec3(userFormat)) {
    return Array.isArray(userFormat.vec3)
      ? ofVecSplit(userFormat.vec3)
      : ofVecDirect(userFormat.vec3, 3);
  } else if (isUserFormatVec4(userFormat)) {
    return Array.isArray(userFormat.vec4)
      ? ofVecSplit(userFormat.vec4)
      : ofVecDirect(userFormat.vec4, 4);
  } else if (isUserFormatEntityIndex(userFormat)) {
    if (entityCache !== undefined && entityCache.isResizeable) {
      return ofEntityIndex(userFormat.entityIdKey, entityCache as WPKEntityCache<TEntityFormat, any, true>);
    } else {
      throw Error(`Cannot create entity index format reference with fixed size entity cache from ${JSON.stringify(userFormat)}`);
    }
  } else {
    throw Error(`Cannot create format reference from ${JSON.stringify(userFormat)}`);
  }
};

const ofScalar = <TEntityFormat extends WPKInstanceFormat>(path: string): WPKUserFormatRef<TEntityFormat> => {
  lazyDebug(LOGGER, () => `Creating scalar ref from path '${path}'`);
  const refPath = toRefPath(path);
  return {
    datumCount: 1,
    valuesOf: (instance) => {
      const value = valueOfInstanceAtPath(instance, refPath);
      lazyTrace(LOGGER, () => `Found value ${JSON.stringify(value)} at path '${path}'`);
      return value;
    },
  };
};
const ofVecDirect = <TEntityFormat extends WPKInstanceFormat>(path: string, vecLength: number): WPKUserFormatRef<TEntityFormat> => {
  lazyDebug(LOGGER, () => `Creating vec direct ref from path '${path}'`);
  const refPath = toRefPath(path);
  return {
    datumCount: vecLength,
    valuesOf: (instance) => {
      const value = valueAtPath(instance, refPath, 0);
      if (Array.isArray(value)) {
        lazyTrace(LOGGER, () => `Found array ${JSON.stringify(value)} at path '${path}'`);
        return value;
      }
      throw Error(`Value ${JSON.stringify(value)} at path ${refPath} is not an array`);
    },
  };
};
const ofVecSplit = <TEntityFormat extends WPKInstanceFormat>(paths: string[]): WPKUserFormatRef<TEntityFormat> => {
  lazyDebug(LOGGER, () => `Creating vec split ref from path '${JSON.stringify(paths)}'`);
  const refPaths = paths.map(toRefPath);
  return {
    datumCount: paths.length,
    valuesOf: (instance) => {
      const values = refPaths.map(refPath => valueOfInstanceAtPath(instance, refPath));
      lazyTrace(LOGGER, () => `Found array ${JSON.stringify(values)} at paths '${JSON.stringify(paths)}'`);
      return values;
    },
  };
};
const ofEntityIndex = <TEntityFormat extends WPKInstanceFormat>(entityIdKey: string, target: WPKEntityCache<any, any, true>): WPKUserFormatRef<TEntityFormat> => {
  lazyDebug(LOGGER, () => `Creating entity index ref from entity id key '${entityIdKey}'`);
  const refPath = toRefPath(entityIdKey);
  return {
    datumCount: 1,
    valuesOf(instance) {
      const id = valueAtPath(instance, refPath, 0);
      if (typeof id !== 'string') {
        throw Error(`Value found at path ${entityIdKey} must be a string but was a ${typeof id}`);
      } else {
        const index = target.indexOf(id);
        if (index === -1) {
          lazyWarn(LOGGER, () => `ID at path ${entityIdKey} was '${id}' and could not be found, index falling back to -1`);
        }
        lazyTrace(LOGGER, () => `Found entity index ${index} for id '${id}'`);
        return index;
      }
    },
  };
};

const toRefPath = (path: string): WPKRefPath => {
  const parts = path.split('.');
  const refPath = parts.map(part => stringFuncs.canBePositiveInt(part)
    ? Number(part)
    : part);
  lazyTrace(LOGGER, () => `Converted path '${path}' to ref path ${JSON.stringify(refPath)}`);
  return refPath;
};
const valueAtPath = (input: any, refPath: WPKRefPath, pathIndex: number): unknown => {
  if (pathIndex > refPath.length) {
    throw Error(`Cannot use index ${pathIndex} larger than reference path. Path: ${refPath}. Input: ${JSON.stringify(input)}`);
  }
  if (pathIndex === refPath.length) {
    lazyTrace(LOGGER, () => `Found value ${input} at path ${JSON.stringify(refPath)}`);
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
const valueOfInstanceAtPath = <TEntityFormat extends WPKInstanceFormat>(instance: WPKInstanceOf<TEntityFormat>, refPath: WPKRefPath): number => {
  const value = valueAtPath(instance, refPath, 0);
  if (typeof value === 'number') {
    return value;
  }
  throw Error(`Value ${JSON.stringify(value)} at path ${refPath} is not a number`);
};
