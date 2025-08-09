import { isUserFormatBoolean, isUserFormatEntityIndex, isUserFormatNumber, isUserFormatVec2, isUserFormatVec3, isUserFormatVec4, toDatumCount, WPKPrimitive, WPKUserFormat } from './buffer-formats';
import { WPKCacheResizeable, WPKEntityCache } from './cache';
import { datumExtractorFactory, WPKDatumExtractor } from './datum-extractor';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { logFactory } from './logging';
import { strideFuncs } from './strides';
import { callCreatorOf, floatFuncs, logFuncs } from './utils';

export type WPKDatumBridge<TFormat extends WPKInstanceFormat> = {
  stride: number;
  bridge: WPKDatumBridgeFunc<TFormat>;
};
type WPKDatumBridgeFunc<TFormat extends WPKInstanceFormat> = (offset: number, instance: WPKInstanceOf<TFormat>, dataView: DataView) => void;
type WPKDatumSetter = (target: DataView, offset: number, value: number, littleEndian: boolean) => void;

const LOGGER = logFactory.getLogger('data');

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

const littleEndian = true;

export const datumBridgeFactory = {
  of: <TFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TFormat, any>, datumOffset: number, entityCache?: WPKEntityCache<TFormat, any, any>): WPKDatumBridge<TFormat> => {
    const { datumType } = userFormat;
    const datumCount = toDatumCount(userFormat);
    const datumStride = strideFuncs.ofVertexFormat(datumType);
    const stride = datumCount * datumStride;
    const datumSetter = datumSetters.get(datumType);
    if (datumSetter === undefined) {
      throw Error(`Cannot set datum of type ${datumType}`);
    }
    if (isUserFormatBoolean(userFormat)) {
      return {
        stride,
        bridge: datumBridgeFactory.ofBoolean(datumExtractorFactory.ofBoolean(userFormat), datumSetter, datumOffset),
      };
    } else if (isUserFormatNumber(userFormat)) {
      return {
        stride,
        bridge: datumBridgeFactory.ofNumber(datumExtractorFactory.ofNumber(userFormat), datumSetter, datumOffset),
      };
    } else if (isUserFormatVec2(userFormat) || isUserFormatVec3(userFormat) || isUserFormatVec4(userFormat)) {
      return {
        stride,
        bridge: datumBridgeFactory.ofVec(datumExtractorFactory.ofVec(userFormat), datumSetter, datumOffset, datumStride),
      };
    } else if (isUserFormatEntityIndex(userFormat) && entityCache !== undefined && entityCache.isResizeable) {
      return {
        stride,
        bridge: datumBridgeFactory.ofEntityIndex(datumExtractorFactory.ofEntityId(userFormat), datumSetter, datumOffset, entityCache as WPKCacheResizeable<TFormat>),
      };
    }
    throw Error(`Cannot create datum bridge from user format ${JSON.stringify(userFormat)}`);
  },
  ofBoolean: <TFormat extends WPKInstanceFormat>(extractor: WPKDatumExtractor<TFormat, boolean>, setter: WPKDatumSetter, datumOffset: number): WPKDatumBridgeFunc<TFormat> => {
    return (offset, instance, dataView) => {
      const datum = extractor(instance);
      const value = datum ? 1 : 0;
      const dataViewOffset = offset + datumOffset;
      logFuncs.lazyTrace(LOGGER, () => `Setting ${value} at offset ${dataViewOffset}`);
      setter(dataView, offset + datumOffset, value, littleEndian);
    };
  },
  ofNumber: <TFormat extends WPKInstanceFormat>(extractor: WPKDatumExtractor<TFormat, number>, setter: WPKDatumSetter, datumOffset: number): WPKDatumBridgeFunc<TFormat> => {
    return (offset, instance, dataView) => {
      const value = extractor(instance);
      const dataViewOffset = offset + datumOffset;
      logFuncs.lazyTrace(LOGGER, () => `Setting ${value} at offset ${dataViewOffset}`);
      setter(dataView, offset + datumOffset, value, littleEndian);
    };
  },
  ofVec: <TFormat extends WPKInstanceFormat>(extractor: WPKDatumExtractor<TFormat, number[]>, setter: WPKDatumSetter, datumOffset: number, datumStride: number): WPKDatumBridgeFunc<TFormat> => {
    return (offset, instance, dataView) => {
      const values = extractor(instance);
      let dataViewOffset = offset + datumOffset;
      for (const value of values) {
        logFuncs.lazyTrace(LOGGER, () => `Setting ${value} at offset ${dataViewOffset}`);
        setter(dataView, offset + datumOffset, value, littleEndian);
        dataViewOffset += datumStride;
      }
    };
  },
  ofEntityIndex: <TFormat extends WPKInstanceFormat>(extractor: WPKDatumExtractor<TFormat, string>, setter: WPKDatumSetter, datumOffset: number, entityCache: WPKCacheResizeable<TFormat>): WPKDatumBridgeFunc<TFormat> => {
    return (offset, instance, dataView) => {
      const id = extractor(instance);
      const index = entityCache.indexOf(id);
      let dataViewOffset = offset + datumOffset;
      logFuncs.lazyTrace(LOGGER, () => `Setting ${index} at offset ${dataViewOffset}`);
      setter(dataView, offset + datumOffset, index, littleEndian);
    };
  },
};
