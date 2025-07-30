import { WPKFormatRef, WPKFormatReference } from './buffer-types';
import { WPKInstanceFormat, WPKInstanceOf } from './instance-types';

export const formatValuesFuncs = {
  ofScalar: <TFormat extends WPKInstanceFormat>(formatReference: WPKFormatReference<TFormat>, instance: WPKInstanceOf<TFormat>): number => {
    const { ref_0 } = formatReference as WPKFormatRef<keyof TFormat>;
    return (instance as Record<keyof TFormat, number>)[ref_0];
  },
  ofTuple: <TFormat extends WPKInstanceFormat>(formatReference: WPKFormatReference<TFormat>, instance: WPKInstanceOf<TFormat>): number => {
    const { ref_0, ref_1 } = formatReference as unknown as WPKFormatRef<keyof TFormat, number>;
    return (instance as Record<keyof TFormat, number[]>)[ref_0][ref_1];
  },
  ofNamed: <TFormat extends WPKInstanceFormat>(formatReference: WPKFormatReference<TFormat>, instance: WPKInstanceOf<TFormat>): number => {
    const { ref_0, ref_1 } = formatReference as WPKFormatRef<keyof TFormat, string>;
    return (instance as Record<keyof TFormat, Record<string, number>>)[ref_0][ref_1];
  },
};
