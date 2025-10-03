import { DISPATCH_PARAMS_BUFFER_NAME, WPKBufferFormatElementUniform, WPKDispatchParams, WPKGroupBinding, WPKGroupIndex } from './types';

const MAX_GROUP_INDEX = 3;
const MAX_BINDING_INDEX = 7;

export const shaderReserved = {
  MAX_GROUP_INDEX,
  DISPATCH_PARAMS_BUFFER_NAME,
  DISPATCH_GROUP_BINDING: {
    group: MAX_GROUP_INDEX as WPKGroupIndex,
    binding: MAX_BINDING_INDEX,
    buffer: DISPATCH_PARAMS_BUFFER_NAME,
  } as WPKGroupBinding<any, any, any, any, any>,
  DISPATCH_MARSHALLED_FORMAT: {
    instance_count: {
      datumType: 'u32',
      scalar: 'instanceCount'
    } as WPKBufferFormatElementUniform<WPKDispatchParams>,
  },
};
