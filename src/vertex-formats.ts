import { WGBKElementLayout, WGBKMarshalledFormatElement } from './buffer-resource-types';
import { WGBKInstanceFormat } from './instance';

export const VertexFormats = {
  ofElementLayout: (elementLayout: WGBKElementLayout): GPUVertexFormat => {
    const { datumType, dimension } = elementLayout;
    switch (dimension) {
    case 'scalar': return datumType;
    case 'vec2': return `${datumType}x2`;
    case 'vec3': return `${datumType}x3`;
    case 'vec4': return `${datumType}x4`;
    }
  },
  ofFormatElement: <TFormat extends WGBKInstanceFormat>(formatElement: WGBKMarshalledFormatElement<TFormat>): GPUVertexFormat => {
    const { datumType, scalar, vec } = formatElement;
    if (scalar !== undefined) {
      return datumType;
    }
    if (vec !== undefined) {
      return `${datumType}x${vec.length}` as GPUVertexFormat;
    }
    throw Error('Format Element requires exactly one of the fields [\'scalar\', \'vec\']');
  },
};
