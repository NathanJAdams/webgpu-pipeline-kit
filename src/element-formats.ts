export type WGBKScalarFormat = 'scalar';
export type WGBKTupleFormat = 2 | 3 | 4;
export type WGBKNamedFormat = string[] & { length: WGBKTupleFormat; };
export type WGBKElementFormat = WGBKScalarFormat | WGBKTupleFormat | WGBKNamedFormat;

export const WGBKElementFormats = {
  isScalar: (format: WGBKElementFormat): format is WGBKScalarFormat => format === 'scalar',
  isTuple: (format: WGBKElementFormat): format is WGBKTupleFormat => ((format === 2) || (format === 3) || (format === 4)),
  isNamed: (format: WGBKElementFormat): format is WGBKNamedFormat => Array.isArray(format) && WGBKElementFormats.isTuple(format.length as WGBKElementFormat) && format.every(element => typeof element === 'string'),
};
