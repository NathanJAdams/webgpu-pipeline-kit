import { isUserFormatNumber, isUserFormatVec2, isUserFormatVec3, isUserFormatVec4, WPKFormatLayout, WPKFormatMarshall, WPKLayout, WPKPrimitive, WPKUserFormat } from './buffer-formats';
import { WPKInstanceFormat } from './instance';

export const strideFuncs = {
  ofVertexFormat: (format: WPKPrimitive): number => {
    switch (format) {
      case 'float16': return 2;
      case 'float32': return 4;
      case 'sint16': return 2;
      case 'sint32': return 4;
      case 'sint8': return 1;
      case 'snorm16': return 2;
      case 'snorm8': return 1;
      case 'uint16': return 2;
      case 'uint32': return 4;
      case 'uint8': return 1;
      case 'unorm16': return 2;
      case 'unorm8': return 1;
    }
  },
  dimensionMultipleOfUserFormat: <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TEntityFormat, any>): number => {
    if (isUserFormatNumber(userFormat)) {
      return 1;
    } else if (isUserFormatVec2(userFormat)) {
      return 2;
    } else if (isUserFormatVec3(userFormat)) {
      return 3;
    } else if (isUserFormatVec4(userFormat)) {
      return 4;
    }
    throw Error(`Cannot find dimension of user format ${JSON.stringify(userFormat)}`);
  },
  dimensionMultipleOfLayout: (dimension: 'boolean' | 'number' | 'vec2' | 'vec3' | 'vec4'): number => {
    switch (dimension) {
      case 'boolean': return 1;
      case 'number': return 1;
      case 'vec2': return 2;
      case 'vec3': return 3;
      case 'vec4': return 4;
    }
  },
  ofLayout: (layout: WPKLayout): number => strideFuncs.dimensionMultipleOfLayout(layout.dimension) * strideFuncs.ofVertexFormat(layout.datumType),
  ofFormatLayout: (formatLayout: WPKFormatLayout): number => {
    return formatLayout.reduce((acc, layout) => acc + strideFuncs.ofLayout(layout), 0);
  },
  ofUserFormat: <TFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TFormat, any>): number => {
    const datumStride = strideFuncs.ofVertexFormat(userFormat.datumType);
    const multiple = strideFuncs.dimensionMultipleOfUserFormat(userFormat);
    return datumStride * multiple;
  },
  ofFormatMarshall: <TFormat extends WPKInstanceFormat>(format: WPKFormatMarshall<TFormat, any>): number => {
    return format.reduce((acc, userFormat) => acc + strideFuncs.ofUserFormat(userFormat), 0);
  },
};
