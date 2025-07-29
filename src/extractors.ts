import { WGBKFormatReference, WGBKMarshalledFormat, WGBKMarshalledFormatElement, WGBKSimpleVertexFormat } from './buffer-resource-types';
import { WGBKFormatReferences } from './format-references';
import { WGBKFormatValues } from './format-values';
import { WGBKInstanceFormat, WGBKInstanceOf } from './instance';
import { WGBKStrides } from './strides';
import { callCreatorOf, float32ToFloat16 } from './utils';

type Extractor<TFormat extends WGBKInstanceFormat> = (offset: number, instance: WGBKInstanceOf<TFormat>, dataView: DataView) => void;
export type BufferFormatExtractor<TFormat extends WGBKInstanceFormat> = {
    extract: (instances: WGBKInstanceOf<TFormat>[]) => ArrayBuffer;
};
type DatumGetter<TFormat extends WGBKInstanceFormat> = (instance: WGBKInstanceOf<TFormat>) => number;
type DatumSetter = (target: DataView, offset: number, value: number, littleEndian: boolean) => void;

const createDatumSetters = (): Map<WGBKSimpleVertexFormat, DatumSetter> => {
  const dataViewCallCreator = callCreatorOf<DataView>();
  const map = new Map<WGBKSimpleVertexFormat, DatumSetter>();
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
  map.set('float16', (target: DataView, offset: number, value: number, littleEndian: boolean) => setUint16(target, offset, float32ToFloat16(value), littleEndian));
  map.set('float32', setFloat32);
  return map;
};

const datumSetters = createDatumSetters();

const LITTLE_ENDIAN = true;

const createDatumGetter = <TFormat extends WGBKInstanceFormat>(formatReference: WGBKFormatReference<TFormat>): DatumGetter<TFormat> => {
  return (instance) => {
    if (WGBKFormatReferences.isScalar(formatReference)) {
      return WGBKFormatValues.ofScalar(formatReference, instance);
    }
    if (WGBKFormatReferences.isTuple(formatReference)) {
      return WGBKFormatValues.ofTuple(formatReference, instance);
    }
    if (WGBKFormatReferences.isNamed(formatReference)) {
      return WGBKFormatValues.ofNamed(formatReference, instance);
    }
    throw Error(`Cannot get datum from unknown format reference: ${JSON.stringify(formatReference)}`);
  };
};
const createDatumGetters = <TFormat extends WGBKInstanceFormat>(formatElement: WGBKMarshalledFormatElement<TFormat>): DatumGetter<TFormat>[] => {
  const formatReferences = WGBKFormatReferences.toFormatReferences(formatElement);
  return formatReferences.map((formatReference) => createDatumGetter(formatReference));
};

export const WGBKExtractors = {
  of: <TFormat extends WGBKInstanceFormat>(bufferFormat: WGBKMarshalledFormat<TFormat>): BufferFormatExtractor<TFormat> => {
    let totalStride = 0;
    const extractors: Extractor<TFormat>[] = [];
    for (const formatElement of bufferFormat) {
      const datumGetters = createDatumGetters(formatElement);
      const { datumType } = formatElement;
      const datumStride = WGBKStrides.ofVertexFormat(datumType);
      const datumSetter = datumSetters.get(datumType);
      if (datumGetters === undefined || datumSetter === undefined) {
        throw Error(`Cannot set datum of type ${datumType}`);
      }
      for (const datumGetter of datumGetters) {
        const datumOffset = totalStride;
        extractors.push((offset, instance, dataView) => datumSetter(dataView, offset + datumOffset, datumGetter(instance), LITTLE_ENDIAN));
        totalStride += datumStride;
      }
    }
    return {
      extract(instances) {
        const totalSize = instances.length * totalStride;
        const buffer = new ArrayBuffer(totalSize);
        const dataView = new DataView(buffer);
        instances.entries().forEach(([index, instance]) => extractors.forEach((extractor) => extractor(index * totalStride, instance, dataView)));
        return buffer;
      },
    };
  },
};
