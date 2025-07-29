import { WGBKFormatRef, WGBKFormatReference } from './buffer-resource-types';
import { WGBKInstanceFormat, WGBKInstanceOf } from './instance';

export const WGBKFormatValues = {
  ofScalar: <TFormat extends WGBKInstanceFormat>(formatReference: WGBKFormatReference<TFormat>, instance: WGBKInstanceOf<TFormat>): number => {
    const { ref_0 } = formatReference as WGBKFormatRef<keyof TFormat>;
    return (instance as Record<keyof TFormat, number>)[ref_0];
  },
  ofTuple: <TFormat extends WGBKInstanceFormat>(formatReference: WGBKFormatReference<TFormat>, instance: WGBKInstanceOf<TFormat>): number => {
    const { ref_0, ref_1 } = formatReference as unknown as WGBKFormatRef<keyof TFormat, number>;
    return (instance as Record<keyof TFormat, number[]>)[ref_0][ref_1];
  },
  ofNamed: <TFormat extends WGBKInstanceFormat>(formatReference: WGBKFormatReference<TFormat>, instance: WGBKInstanceOf<TFormat>): number => {
    const { ref_0, ref_1 } = formatReference as WGBKFormatRef<keyof TFormat, string>;
    return (instance as Record<keyof TFormat, Record<string, number>>)[ref_0][ref_1];
  },
};
