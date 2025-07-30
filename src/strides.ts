import { WPKElementLayout, WPKMarshalledFormat, WPKMarshalledFormatElement, WPKMarshalledFormatElementBase, WPKHasScalarXorVec, WPKSimpleVertexFormat } from './buffer-types';
import { WPKElementFormat, elementFormatFuncs } from './element-formats';
import { WPKInstanceFormat } from './instance-types';
import { NonEmptyArray } from './utils';

export const strideFuncs = {
  ofVertexFormat: (format: WPKSimpleVertexFormat): number => {
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
  dimensionMultiple: (dimension: 'scalar' | 'vec2' | 'vec3' | 'vec4'): number => {
    switch (dimension) {
    case 'scalar': return 1;
    case 'vec2': return 2;
    case 'vec3': return 3;
    case 'vec4': return 4;
    }
  },
  ofElementFormat: (format: WPKElementFormat): number => {
    return elementFormatFuncs.isScalar(format)
      ? 1
      : elementFormatFuncs.isTuple(format)
        ? format as number
        : format.length;
  },
  ofElementLayout: (elementLayout: WPKElementLayout): number => {
    const { datumType, dimension } = elementLayout;
    return strideFuncs.ofVertexFormat(datumType) * strideFuncs.dimensionMultiple(dimension);
  },
  ofLayout: (layout: NonEmptyArray<WPKElementLayout>): number => {
    return layout.reduce((acc, element) => acc + strideFuncs.ofElementLayout(element), 0);
  },
  ofMarshalledFormatElement: <TFormat extends WPKInstanceFormat>(element: WPKMarshalledFormatElement<TFormat>): number => {
    const { datumType, vec } = element as WPKMarshalledFormatElementBase<WPKSimpleVertexFormat> & WPKHasScalarXorVec<TFormat, 2 | 3 | 4>;
    const multiple = (vec !== undefined)
      ? vec.length
      : 1;
    return strideFuncs.ofVertexFormat(datumType) * multiple;
  },
  ofMarshalledFormat: <TFormat extends WPKInstanceFormat>(format: WPKMarshalledFormat<TFormat>): number => {
    return format.reduce((acc, element) => acc + strideFuncs.ofMarshalledFormatElement(element), 0);
  },
};
