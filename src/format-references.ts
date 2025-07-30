import { WPKFormatRef, WPKFormatReference, WPKMarshalledFormatElement, WPKNamedFormatReference, WPKScalarFormatReference, WPKHasScalarXorVec, WPKTupleFormatReference } from './buffer-types';
import { WPKInstanceFormat } from './instance-types';

export const formatReferenceFuncs = {
  toFormatReferences: <TFormat extends WPKInstanceFormat>(formatElement: WPKMarshalledFormatElement<TFormat>): WPKFormatReference<TFormat>[] => {
    const { scalar, vec } = formatElement as WPKHasScalarXorVec<TFormat, 2 | 3 | 4>;
    if (scalar !== undefined) {
      return [scalar];
    }
    if (vec !== undefined) {
      return vec;
    }
    throw Error(`Cannot find format references from element: ${JSON.stringify(formatElement)}`);
  },
  isScalar: <TFormat extends WPKInstanceFormat>(formatReference: WPKFormatReference<TFormat>): formatReference is WPKScalarFormatReference<TFormat> => {
    const { ref_1 } = formatReference as WPKFormatRef<keyof TFormat, string>;
    return (ref_1 === undefined);
  },
  isTuple: <TFormat extends WPKInstanceFormat>(formatReference: WPKFormatReference<TFormat>): formatReference is WPKTupleFormatReference<TFormat> => {
    const { ref_1 } = formatReference as unknown as WPKFormatRef<keyof TFormat, number>;
    return (typeof ref_1 === 'number');
  },
  isNamed: <TFormat extends WPKInstanceFormat>(formatReference: WPKFormatReference<TFormat>): formatReference is WPKNamedFormatReference<TFormat> => {
    const { ref_1 } = formatReference as WPKFormatRef<keyof TFormat, string>;
    return (typeof ref_1 === 'string');
  },
};
