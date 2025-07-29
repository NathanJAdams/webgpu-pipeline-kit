import { WGBKElementLayout, WGBKMarshalledFormat, WGBKMarshalledFormatElement, WGBKMarshalledFormatElementBase, WGBKHasScalarXorVec, WGBKSimpleVertexFormat } from './buffer-resource-types';
import { WGBKElementFormat, WGBKElementFormats } from './element-formats';
import { WGBKInstanceFormat } from './instance';
import { NonEmptyArray } from './utils';

export const WGBKStrides = {
  ofVertexFormat: (format: WGBKSimpleVertexFormat): number => {
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
  ofElementFormat: (format: WGBKElementFormat): number => {
    return WGBKElementFormats.isScalar(format)
      ? 1
      : WGBKElementFormats.isTuple(format)
        ? format as number
        : format.length;
  },
  ofElementLayout: (elementLayout: WGBKElementLayout): number => {
    const { datumType, dimension } = elementLayout;
    return WGBKStrides.ofVertexFormat(datumType) * WGBKStrides.dimensionMultiple(dimension);
  },
  ofLayout: (layout: NonEmptyArray<WGBKElementLayout>): number => {
    return layout.reduce((acc, element) => acc + WGBKStrides.ofElementLayout(element), 0);
  },
  ofMarshalledFormatElement: <TFormat extends WGBKInstanceFormat>(element: WGBKMarshalledFormatElement<TFormat>): number => {
    const { datumType, vec } = element as WGBKMarshalledFormatElementBase<WGBKSimpleVertexFormat> & WGBKHasScalarXorVec<TFormat, 2 | 3 | 4>;
    const multiple = (vec !== undefined)
      ? vec.length
      : 1;
    return WGBKStrides.ofVertexFormat(datumType) * multiple;
  },
  ofMarshalledFormat: <TFormat extends WGBKInstanceFormat>(format: WGBKMarshalledFormat<TFormat>): number => {
    return format.reduce((acc, element) => acc + WGBKStrides.ofMarshalledFormatElement(element), 0);
  },
};
