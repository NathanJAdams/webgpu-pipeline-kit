import { bufferFormatFuncs } from './buffer-formats';
import { datumExtractorFactory } from './datum-extraction';
import { logFactory } from './logging';
import { DATUM_TYPE_BYTE_LENGTHS } from './shader-utils';
import { WPKBufferFormatElement, WPKCacheResizeable, WPKDatumBridge, WPKDatumBridgeFunc, WPKDatumExtractor, WPKDatumSetter, WPKDatumSetterFunc, WPKEntityCache, WPKShaderScalar } from './types';
import { callCreatorOf, logFuncs } from './utils';

const LOGGER = logFactory.getLogger('data');

const createDatumSetters = (): Map<WPKShaderScalar, WPKDatumSetter> => {
  const dataViewCallCreator = callCreatorOf<DataView>();
  const map = new Map<WPKShaderScalar, WPKDatumSetter>();
  const setInt32 = dataViewCallCreator('setInt32');
  const setUint32 = dataViewCallCreator('setUint32');
  const setFloat32 = dataViewCallCreator('setFloat32');
  map.set('f32', { stride: 4, set: setFloat32 });
  map.set('i32', { stride: 4, set: setInt32 });
  map.set('u32', { stride: 4, set: setUint32 });
  return map;
};

const datumSetters = createDatumSetters();

const littleEndian = true;

export const datumBridgeFactory = {
  of: <T>(formatElement: WPKBufferFormatElement<T>, datumOffset: number, entityCache?: WPKEntityCache<T, any, any>): WPKDatumBridge<T> => {
    const { datumType } = formatElement;
    const componentType = toComponentType(formatElement);
    const datumSetter = datumSetters.get(componentType);
    if (datumSetter === undefined) {
      throw Error(`Cannot set datum of type ${datumType}`);
    }
    const datumStride = datumSetter.stride;
    const stride = DATUM_TYPE_BYTE_LENGTHS[datumType];
    if (bufferFormatFuncs.isEntityIndex(formatElement) && entityCache !== undefined && entityCache.isResizeable) {
      return {
        stride,
        bridge: datumBridgeFactory.ofEntityIndex(datumExtractorFactory.ofEntityId(formatElement), datumSetter.set, datumOffset, entityCache as WPKCacheResizeable<T>),
      };
    } else if (bufferFormatFuncs.isScalar(formatElement)) {
      return {
        stride,
        bridge: datumBridgeFactory.ofNumber(datumExtractorFactory.ofScalar(formatElement), datumSetter.set, datumOffset),
      };
    } else if (bufferFormatFuncs.isVector(formatElement)) {
      return {
        stride,
        bridge: datumBridgeFactory.ofNumberArray(datumExtractorFactory.ofVector(formatElement), datumSetter.set, datumOffset, datumStride),
      };
    } else if (bufferFormatFuncs.isMatrix(formatElement)) {
      return {
        stride,
        bridge: datumBridgeFactory.ofNumberArray(datumExtractorFactory.ofMatrix(formatElement), datumSetter.set, datumOffset, datumStride),
      };
    } else if (bufferFormatFuncs.isEntityIndex(formatElement) && entityCache !== undefined && entityCache.isResizeable) {
      return {
        stride,
        bridge: datumBridgeFactory.ofEntityIndex(datumExtractorFactory.ofEntityId(formatElement), datumSetter.set, datumOffset, entityCache as WPKCacheResizeable<T>),
      };
    }
    throw Error(`Cannot create datum bridge from user format ${JSON.stringify(formatElement)}`);
  },
  ofNumber: <T>(extractor: WPKDatumExtractor<T, number>, setterFunc: WPKDatumSetterFunc, datumOffset: number): WPKDatumBridgeFunc<T> => {
    return (offset, instance, dataView) => {
      const value = extractor(instance);
      const dataViewOffset = offset + datumOffset;
      logFuncs.lazyTrace(LOGGER, () => `Setting ${value} at offset ${dataViewOffset}`);
      setterFunc(dataView, offset + datumOffset, value, littleEndian);
    };
  },
  ofNumberArray: <T>(extractor: WPKDatumExtractor<T, number[]>, setterFunc: WPKDatumSetterFunc, datumOffset: number, datumStride: number): WPKDatumBridgeFunc<T> => {
    return (offset, instance, dataView) => {
      const values = extractor(instance);
      let dataViewOffset = offset + datumOffset;
      for (const value of values) {
        logFuncs.lazyTrace(LOGGER, () => `Setting ${value} at offset ${dataViewOffset}`);
        setterFunc(dataView, offset + datumOffset, value, littleEndian);
        dataViewOffset += datumStride;
      }
    };
  },
  ofEntityIndex: <T>(extractor: WPKDatumExtractor<T, string>, setterFunc: WPKDatumSetterFunc, datumOffset: number, entityCache: WPKCacheResizeable<T>): WPKDatumBridgeFunc<T> => {
    return (offset, instance, dataView) => {
      const id = extractor(instance);
      const index = entityCache.indexOf(id);
      let dataViewOffset = offset + datumOffset;
      logFuncs.lazyTrace(LOGGER, () => `Setting ${index} at offset ${dataViewOffset}`);
      setterFunc(dataView, offset + datumOffset, index, littleEndian);
    };
  },
};

const toComponentType = (formatElement: WPKBufferFormatElement<any>): WPKShaderScalar => {
  if (bufferFormatFuncs.isScalar(formatElement)) {
    return formatElement.datumType;
  }
  const componentTypeMatch = formatElement.datumType.match(/[^<]+<([fiu]32)>/);
  if (componentTypeMatch) {
    return componentTypeMatch[1] as WPKShaderScalar;
  }
  throw Error(`Cannot find component type of datum type ${formatElement.datumType}`);
};
