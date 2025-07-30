export type WPKScalarFormat = 'scalar';
export type WPKTupleFormat = 2 | 3 | 4;
export type WPKNamedFormat = string[] & { length: WPKTupleFormat; };
export type WPKElementFormat = WPKScalarFormat | WPKTupleFormat | WPKNamedFormat;

export const elementFormatFuncs = {
  isScalar: (format: WPKElementFormat): format is WPKScalarFormat => format === 'scalar',
  isTuple: (format: WPKElementFormat): format is WPKTupleFormat => ((format === 2) || (format === 3) || (format === 4)),
  isNamed: (format: WPKElementFormat): format is WPKNamedFormat => Array.isArray(format) && elementFormatFuncs.isTuple(format.length as WPKElementFormat) && format.every(element => typeof element === 'string'),
};
