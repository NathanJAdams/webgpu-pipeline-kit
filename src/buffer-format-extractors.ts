import { WPKFormatReference, WPKMarshalledFormat, WPKMarshalledFormatElement, WPKSimpleVertexFormat } from './buffer-types';
import { formatReferenceFuncs } from './format-references';
import { formatValuesFuncs } from './format-values';
import { WPKInstanceFormat, WPKInstanceOf } from './instance-types';
import { strideFuncs } from './strides';
import { callCreatorOf, float32ToFloat16 } from './utils';

type WPKExtractor<TFormat extends WPKInstanceFormat> = (offset: number, instance: WPKInstanceOf<TFormat>, dataView: DataView) => void;
export type WPKBufferFormatExtractor<TFormat extends WPKInstanceFormat> = {
    extract: (instances: WPKInstanceOf<TFormat>[]) => ArrayBuffer;
};
type WPKDatumGetter<TFormat extends WPKInstanceFormat> = (instance: WPKInstanceOf<TFormat>) => number;
type WPKDatumSetter = (target: DataView, offset: number, value: number, littleEndian: boolean) => void;

const createDatumSetters = (): Map<WPKSimpleVertexFormat, WPKDatumSetter> => {
  const dataViewCallCreator = callCreatorOf<DataView>();
  const map = new Map<WPKSimpleVertexFormat, WPKDatumSetter>();
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

const createDatumGetter = <TFormat extends WPKInstanceFormat>(formatReference: WPKFormatReference<TFormat>): WPKDatumGetter<TFormat> => {
  return (instance) => {
    if (formatReferenceFuncs.isScalar(formatReference)) {
      return formatValuesFuncs.ofScalar(formatReference, instance);
    }
    if (formatReferenceFuncs.isTuple(formatReference)) {
      return formatValuesFuncs.ofTuple(formatReference, instance);
    }
    if (formatReferenceFuncs.isNamed(formatReference)) {
      return formatValuesFuncs.ofNamed(formatReference, instance);
    }
    throw Error(`Cannot get datum from unknown format reference: ${JSON.stringify(formatReference)}`);
  };
};
const createDatumGetters = <TFormat extends WPKInstanceFormat>(formatElement: WPKMarshalledFormatElement<TFormat>): WPKDatumGetter<TFormat>[] => {
  const formatReferences = formatReferenceFuncs.toFormatReferences(formatElement);
  return formatReferences.map((formatReference) => createDatumGetter(formatReference));
};

export const bufferFormatExtractorFactory = {
  of: <TFormat extends WPKInstanceFormat>(bufferFormat: WPKMarshalledFormat<TFormat>): WPKBufferFormatExtractor<TFormat> => {
    let totalStride = 0;
    const extractors: WPKExtractor<TFormat>[] = [];
    for (const formatElement of bufferFormat) {
      const datumGetters = createDatumGetters(formatElement);
      const { datumType } = formatElement;
      const datumStride = strideFuncs.ofVertexFormat(datumType);
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
        instances.forEach((instance, index) => extractors.forEach((extractor) => extractor(index * totalStride, instance, dataView)));
        return buffer;
      },
    };
  },
};
