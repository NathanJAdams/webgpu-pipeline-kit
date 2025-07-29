import { WGBKElementFormat, WGBKElementFormats, WGBKTupleFormat } from './element-formats';
import { TupleOf } from './utils';

export type WGBKScalarElement = number;
export type WGBKTupleElement = TupleOf<number, WGBKTupleFormat>;
export type WGBKNamedElement = { [K in TupleOf<string, WGBKTupleFormat>[number]]: number };

export type WGBKElementType = WGBKScalarElement | WGBKTupleElement | WGBKNamedElement;

export const WGBKElementTypes = {
  isScalar: (element: WGBKElementType): element is WGBKScalarElement => typeof element === 'number',
  isTuple: (element: WGBKElementType): element is WGBKTupleElement => Array.isArray(element) && WGBKElementFormats.isTuple(element.length as WGBKElementFormat) && element.every(WGBKElementTypes.isScalar),
  isNamed: (element: WGBKElementType): element is WGBKNamedElement => Object.values(element).every(WGBKElementTypes.isScalar),
};
