import { toMarshalledRef, WPKFormatMarshall, WPKPrimitive } from './buffer-format';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { strideFuncs } from './strides';
import { callCreatorOf, floatFuncs } from './utils';

type WPKDataBridge<TFormat extends WPKInstanceFormat> = (offset: number, instance: WPKInstanceOf<TFormat>, dataView: DataView) => void;
type WPKDataExtractor<TFormat extends WPKInstanceFormat> = {
  extract: (instances: WPKInstanceOf<TFormat>[]) => ArrayBuffer;
};
type WPKDatumSetter = (target: DataView, offset: number, value: number, littleEndian: boolean) => void;

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
  of: <TFormat extends WPKInstanceFormat>(marshallFormats: WPKFormatMarshall<TFormat>): WPKDataExtractor<TFormat> => {
    let totalStride = 0;
    const dataBridges: WPKDataBridge<TFormat>[] = [];
    for (const format of marshallFormats) {
      const userFormatRef = toMarshalledRef(format);
      const { datumType } = format;
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
          datumSetter(dataView, offset + datumOffset, values, LITTLE_ENDIAN);
        } else {
          for (const value of values) {
            datumSetter(dataView, offset + datumOffset, value, LITTLE_ENDIAN);
            offset += datumStride;
          }
        }
      });
      totalStride += stride;
    }
    return {
      extract(instances) {
        const totalSize = instances.length * totalStride;
        const buffer = new ArrayBuffer(totalSize);
        const dataView = new DataView(buffer);
        instances.forEach((instance, index) => dataBridges.forEach((extractor) => extractor(index * totalStride, instance, dataView)));
        return buffer;
      },
    };
  },
};
