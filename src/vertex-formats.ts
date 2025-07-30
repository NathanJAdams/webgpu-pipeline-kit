import { WPKElementLayout, WPKMarshalledFormatElement } from './buffer-types';
import { WPKInstanceFormat } from './instance-types';

export const vertexFormatsFactory = {
  ofElementLayout: (elementLayout: WPKElementLayout): GPUVertexFormat => {
    const { datumType, dimension } = elementLayout;
    switch (dimension) {
    case 'scalar': return datumType;
    case 'vec2': return `${datumType}x2`;
    case 'vec3': return `${datumType}x3`;
    case 'vec4': return `${datumType}x4`;
    }
  },
  ofFormatElement: <TFormat extends WPKInstanceFormat>(formatElement: WPKMarshalledFormatElement<TFormat>): GPUVertexFormat => {
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
