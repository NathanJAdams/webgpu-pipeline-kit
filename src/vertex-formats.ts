import { WPKLayout, WPKUserFormat } from './buffer-format';
import { WPKInstanceFormat } from './instance';
import { strideFuncs } from './strides';

export const vertexFormatsFactory = {
  ofLayout: (layout: WPKLayout): GPUVertexFormat => {
    const { datumType, dimension } = layout;
    switch (dimension) {
      case 'scalar': return datumType;
      case 'vec2': return `${datumType}x2`;
      case 'vec3': return `${datumType}x3`;
      case 'vec4': return `${datumType}x4`;
    }
  },
  ofUserFormat: <TFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TFormat>): GPUVertexFormat => {
    const { datumType } = userFormat;
    const dimensionMultiple = strideFuncs.dimensionMultipleOfUserFormat(userFormat);
    return (dimensionMultiple === 1)
      ? datumType
      : `${datumType}x${dimensionMultiple}` as GPUVertexFormat;
  },
};
