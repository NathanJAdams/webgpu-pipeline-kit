import { WPKElementFormat, elementFormatFuncs, WPKTupleFormat } from './element-formats';
import { TupleOf } from './utils';

export type WPKScalarElement = number;
export type WPKTupleElement = TupleOf<number, WPKTupleFormat>;
export type WPKNamedElement = { [K in TupleOf<string, WPKTupleFormat>[number]]: number };

export type WPKElementType = WPKScalarElement | WPKTupleElement | WPKNamedElement;

export const elementTypeFuncs = {
  isScalar: (element: WPKElementType): element is WPKScalarElement => typeof element === 'number',
  isTuple: (element: WPKElementType): element is WPKTupleElement => Array.isArray(element) && elementFormatFuncs.isTuple(element.length as WPKElementFormat) && element.every(elementTypeFuncs.isScalar),
  isNamed: (element: WPKElementType): element is WPKNamedElement => Object.values(element).every(elementTypeFuncs.isScalar),
};
