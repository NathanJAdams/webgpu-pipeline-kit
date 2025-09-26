import { bufferFormatFuncs } from './buffer-formats';
import { datumExtractEmbedFactory } from './datum-extract-embed';
import { logFactory } from './logging';
import { shaderFuncs } from './shader-utils';
import { WPKBufferFormatElement, WPKCacheResizeable, WPKDatumBridge, WPKDatumExtractEmbedder, WPKDatumGetSetter, WPKEntityCache, WPKShaderScalar, WPKShaderStructEntry } from './types';
import { callCreatorOf, logFuncs } from './utils';

const LOGGER = logFactory.getLogger('data');

const createDatumGetSetters = (): Map<WPKShaderScalar, WPKDatumGetSetter> => {
  const dataViewCallCreator = callCreatorOf<DataView>();
  const map = new Map<WPKShaderScalar, WPKDatumGetSetter>();
  const setInt32 = dataViewCallCreator('setInt32');
  const setUint32 = dataViewCallCreator('setUint32');
  const setFloat32 = dataViewCallCreator('setFloat32');
  const getInt32 = dataViewCallCreator('getInt32');
  const getUint32 = dataViewCallCreator('getUint32');
  const getFloat32 = dataViewCallCreator('getFloat32');
  map.set('f32', { stride: 4, get: getFloat32, set: setFloat32 });
  map.set('i32', { stride: 4, get: getInt32, set: setInt32 });
  map.set('u32', { stride: 4, get: getUint32, set: setUint32 });
  return map;
};

const datumGetSetters = createDatumGetSetters();

const littleEndian = true;

export const datumBridgeFactory = {
  ofFormatElement: <T>(formatElement: WPKBufferFormatElement<T>, datumOffset: number, entityCache?: WPKEntityCache<T, any, any>): WPKDatumBridge<T> => {
    const { datumType } = formatElement;
    const componentType = shaderFuncs.toComponentType(datumType);
    const datumGetSetter = datumGetSetters.get(componentType);
    if (datumGetSetter === undefined) {
      throw Error(`Cannot create datum bridge for type ${datumType}`);
    }
    const stride = shaderFuncs.toByteLength(datumType);
    if (bufferFormatFuncs.isScalar(formatElement)) {
      const extractEmbedder = datumExtractEmbedFactory.ofScalar(formatElement.scalar);
      return datumBridgeFactory.ofNumber(stride, extractEmbedder, datumGetSetter, datumOffset);
    } else if (bufferFormatFuncs.isVector(formatElement)) {
      const extractEmbedder = datumExtractEmbedFactory.ofVector(formatElement.vector);
      return datumBridgeFactory.ofNumberArray(stride, extractEmbedder, datumGetSetter, datumOffset, shaderFuncs.toDatumLength(datumType));
    } else if (bufferFormatFuncs.isMatrix(formatElement)) {
      const extractEmbedder = datumExtractEmbedFactory.ofMatrix(formatElement.matrix);
      return datumBridgeFactory.ofNumberArray(stride, extractEmbedder, datumGetSetter, datumOffset, shaderFuncs.toDatumLength(datumType));
    } else if (bufferFormatFuncs.isEntityIndex(formatElement) && entityCache !== undefined && entityCache.isResizeable) {
      const extractEmbedder = datumExtractEmbedFactory.ofEntityId(formatElement.entityIdKey);
      return datumBridgeFactory.ofEntityIndex(extractEmbedder, datumGetSetter, datumOffset, entityCache as WPKCacheResizeable<T>);
    } else {
      logFuncs.lazyInfo(LOGGER, () => `datum offset ${datumOffset}, entity cache defined ${entityCache !== undefined} entity cache resizeable ${entityCache?.isResizeable}`);
      throw Error(`Cannot create datum bridge from user format ${JSON.stringify(formatElement)}`);
    }
  },
  ofStructEntry: <T>(structEntry: WPKShaderStructEntry, datumOffset: number): WPKDatumBridge<T> => {
    const { name, datumType } = structEntry;
    const componentType = shaderFuncs.toComponentType(datumType);
    const datumGetSetter = datumGetSetters.get(componentType);
    if (datumGetSetter === undefined) {
      throw Error(`Cannot create datum bridge for type ${datumType}`);
    }
    const stride = shaderFuncs.toByteLength(datumType);
    if (shaderFuncs.isScalar(datumType)) {
      const extractEmbedder = datumExtractEmbedFactory.ofScalar(name);
      return datumBridgeFactory.ofNumber(stride, extractEmbedder, datumGetSetter, datumOffset);
    } else if (shaderFuncs.isVector(datumType)) {
      const extractEmbedder = datumExtractEmbedFactory.ofVector(name);
      return datumBridgeFactory.ofNumberArray(stride, extractEmbedder, datumGetSetter, datumOffset, shaderFuncs.toDatumLength(datumType));
    } else if (shaderFuncs.isMatrix(datumType)) {
      const extractEmbedder = datumExtractEmbedFactory.ofMatrix(name);
      return datumBridgeFactory.ofNumberArray(stride, extractEmbedder, datumGetSetter, datumOffset, shaderFuncs.toDatumLength(datumType));
    } else {
      logFuncs.lazyInfo(LOGGER, () => `datum offset ${datumOffset}`);
      throw Error(`Cannot create datum bridge from user format ${JSON.stringify(structEntry)}`);
    }
  },
  ofNumber: <T>(stride: number, extractEmbedder: WPKDatumExtractEmbedder<T, number>, datumGetSetter: WPKDatumGetSetter, datumOffset: number): WPKDatumBridge<T> => {
    return {
      stride,
      dataViewToInstance: (offset, instance, dataView) => {
        const dataViewOffset = offset + datumOffset;
        const value = datumGetSetter.get(dataView, dataViewOffset, littleEndian);
        logFuncs.lazyTrace(LOGGER, () => `Setting ${value} from offset ${dataViewOffset} on instance`);
        extractEmbedder.embed(instance, value);
      },
      instanceToDataView: (offset, instance, dataView) => {
        const value = extractEmbedder.extract(instance);
        const dataViewOffset = offset + datumOffset;
        logFuncs.lazyTrace(LOGGER, () => `Setting ${value} at offset ${dataViewOffset}`);
        datumGetSetter.set(dataView, dataViewOffset, value, littleEndian);
      },
    };
  },
  ofNumberArray: <T>(stride: number, extractEmbedder: WPKDatumExtractEmbedder<T, number[]>, datumGetSetter: WPKDatumGetSetter, datumOffset: number, datumCount: number): WPKDatumBridge<T> => {
    return {
      stride,
      dataViewToInstance: (offset, instance, dataView) => {
        const values: number[] = new Array(datumCount);
        const dataViewOffset = offset + datumOffset;
        for (let i = 0; i < datumCount; i++) {
          const elementOffset = dataViewOffset + i * datumGetSetter.stride;
          const value = datumGetSetter.get(dataView, elementOffset, littleEndian);
          logFuncs.lazyTrace(LOGGER, () => `Got value ${value} at offset ${elementOffset}`);
          values[i] = value;
        }
        extractEmbedder.embed(instance, values);
      },
      instanceToDataView: (offset, instance, dataView) => {
        const values = extractEmbedder.extract(instance);
        let dataViewOffset = offset + datumOffset;
        for (const value of values) {
          logFuncs.lazyTrace(LOGGER, () => `Setting ${value} at offset ${dataViewOffset}`);
          datumGetSetter.set(dataView, dataViewOffset, value, littleEndian);
          dataViewOffset += datumGetSetter.stride;
        }
      },
    };
  },
  ofEntityIndex: <T>(extractEmbedder: WPKDatumExtractEmbedder<T, string>, datumGetSetter: WPKDatumGetSetter, datumOffset: number, entityCache: WPKCacheResizeable<T>): WPKDatumBridge<T> => {
    return {
      stride: datumGetSetter.stride,
      dataViewToInstance: (offset, instance, dataView) => {
        const dataViewOffset = offset + datumOffset;
        const entityIndex = datumGetSetter.get(dataView, dataViewOffset, littleEndian);
        const id = entityCache.idOf(entityIndex);
        if (id === undefined) {
          logFuncs.lazyWarn(LOGGER, () => `Undefined entity id for index ${entityIndex}`);
        } else {
          logFuncs.lazyTrace(LOGGER, () => `Setting entity id ${id} for index ${entityIndex} from offset ${datumOffset} on instance`);
          extractEmbedder.embed(instance, id);
        }
      },
      instanceToDataView: (offset, instance, dataView) => {
        const id = extractEmbedder.extract(instance);
        const index = entityCache.indexOf(id);
        const dataViewOffset = offset + datumOffset;
        logFuncs.lazyTrace(LOGGER, () => `Setting ${index} at offset ${dataViewOffset}`);
        datumGetSetter.set(dataView, dataViewOffset, index, littleEndian);
      },
    };
  },
};
