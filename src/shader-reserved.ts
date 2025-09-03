import { marshallerFactory } from './marshall';
import { WPKBufferFormatUniform, WPKDispatchParams, WPKGroupBindingInternal, WPKGroupIndexInternal } from './types';

export const MAX_GROUP_INDEX = 3;
export const RESERVED_GROUP_INDEX: WPKGroupIndexInternal = 3;
export const DISPATCH_PARAMS_STRUCT_NAME = 'DispatchParams';
export const DISPATCH_GROUP_BINDING: WPKGroupBindingInternal<any, any, any> = {
  group: RESERVED_GROUP_INDEX,
  binding: 7,
  buffer: DISPATCH_PARAMS_STRUCT_NAME,
};

export const DISPATCH_PARAMS_STRUCT_CODE = `
// reserved
@group(3)
@binding(7)
var<uniform> ${DISPATCH_PARAMS_STRUCT_NAME}: struct {
  instance_count: u32,
  dispatch_size: vec3<u32>,
};`;
export const DISPATCH_FORMAT: WPKBufferFormatUniform<WPKDispatchParams> = {
  bufferType: 'uniform',
  marshall: [
    {
      name: 'instance_count',
      datumType: 'u32',
      scalar: 'instanceCount',
    }, {
      name: 'dispatch_size',
      componentType: 'u32',
      datumType: 'vec3<u32>',
      vector: 'dispatchSize'
    }
  ],
};

export const DISPATCH_MARSHALLER = marshallerFactory.ofMarshalled<WPKDispatchParams>(DISPATCH_FORMAT);
