import { WGBKFormatRef, WGBKFormatReference, WGBKMarshalledFormatElement, WGBKNamedFormatReference, WGBKScalarFormatReference, WGBKHasScalarXorVec, WGBKTupleFormatReference } from './buffer-resource-types';
import { WGBKInstanceFormat } from './instance';

export const WGBKFormatReferences = {
  toFormatReferences: <TFormat extends WGBKInstanceFormat>(formatElement: WGBKMarshalledFormatElement<TFormat>): WGBKFormatReference<TFormat>[] => {
    const { scalar, vec } = formatElement as WGBKHasScalarXorVec<TFormat, 2 | 3 | 4>;
    if (scalar !== undefined) {
      return [scalar];
    }
    if (vec !== undefined) {
      return vec;
    }
    throw Error(`Cannot find format references from element: ${JSON.stringify(formatElement)}`);
  },
  isScalar: <TFormat extends WGBKInstanceFormat>(formatReference: WGBKFormatReference<TFormat>): formatReference is WGBKScalarFormatReference<TFormat> => {
    const { ref_1 } = formatReference as WGBKFormatRef<keyof TFormat, string>;
    return (ref_1 === undefined);
  },
  isTuple: <TFormat extends WGBKInstanceFormat>(formatReference: WGBKFormatReference<TFormat>): formatReference is WGBKTupleFormatReference<TFormat> => {
    const { ref_1 } = formatReference as unknown as WGBKFormatRef<keyof TFormat, number>;
    return (typeof ref_1 === 'number');
  },
  isNamed: <TFormat extends WGBKInstanceFormat>(formatReference: WGBKFormatReference<TFormat>): formatReference is WGBKNamedFormatReference<TFormat> => {
    const { ref_1 } = formatReference as WGBKFormatRef<keyof TFormat, string>;
    return (typeof ref_1 === 'string');
  },
};
