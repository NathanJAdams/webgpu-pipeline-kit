import { WPKBufferFormatMap } from 'webgpu-pipeline-kit';

import { EntityFormat, UniformFormat } from './instance-formats';

export const bufferFormats = {
  uniforms: {
    bufferType: 'uniform',
    contentType: 'marshalled',
    marshall: [{
      datumType: 'float32',
      scalar: 'gameTime',
    }],
  },
  offsets: {
    bufferType: 'entity',
    contentType: 'layout',
    layout: [{
      datumType: 'float32',
      dimension: 'vec2',
    }],
  },
} as const satisfies WPKBufferFormatMap<UniformFormat, EntityFormat>;

export type BufferFormats = typeof bufferFormats;
