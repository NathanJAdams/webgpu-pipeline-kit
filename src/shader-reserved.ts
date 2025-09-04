import { marshallerFactory } from './marshall';
import { WPKBufferFormatUniform, WPKDispatchParams, WPKGroupBinding, WPKGroupIndex } from './types';

export const MAX_GROUP_INDEX = 3;
export const DISPATCH_PARAMS_BUFFER_NAME = 'dispatch';
export const DISPATCH_GROUP_BINDING: WPKGroupBinding<any, any, any, any> = {
  group: 3 as WPKGroupIndex,
  binding: 7,
  buffer: DISPATCH_PARAMS_BUFFER_NAME,
};

export const DISPATCH_FORMAT: WPKBufferFormatUniform<WPKDispatchParams> = {
  bufferType: 'uniform',
  marshall: [
    {
      name: 'instance_count',
      datumType: 'u32',
      scalar: 'instanceCount',
    }, {
      name: 'dispatch_size',
      datumType: 'vec3<u32>',
      vector: 'dispatchSize'
    }
  ],
};

export const DISPATCH_MARSHALLER = marshallerFactory.ofMarshalled<WPKDispatchParams>(DISPATCH_FORMAT);
