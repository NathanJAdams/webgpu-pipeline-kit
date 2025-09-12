import { marshallerFactory } from './marshall';
import { DISPATCH_PARAMS_BUFFER_NAME, WPKBufferFormatElementUniform, WPKBufferFormatUniform, WPKDispatchParams, WPKGroupBinding, WPKGroupIndex, WPKMarshaller, WPKPathVec3 } from './types';

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
  createDispatchFormat: <TEntryPoints extends string[]>(entryPoints: TEntryPoints): WPKBufferFormatUniform<WPKDispatchParams<TEntryPoints>> => {
    return {
      bufferType: 'uniform',
      marshall: [
        {
          name: 'instance_count',
          datumType: 'u32',
          scalar: 'instanceCount'
        },
        ...entryPoints.map((entryPoint): WPKBufferFormatElementUniform<WPKDispatchParams<TEntryPoints>> => ({
          name: shaderReserved.dispatchSizeField(entryPoint),
          datumType: 'vec3<u32>',
          vector: `dispatchSizes.${entryPoint}` as WPKPathVec3<WPKDispatchParams<TEntryPoints>>,
        })),
      ],
    };
  },
  createDispatchMarshaller: <TEntryPoints extends string[]>(dispatchFormat: WPKBufferFormatUniform<WPKDispatchParams<TEntryPoints>>): WPKMarshaller<WPKDispatchParams<TEntryPoints>> => {
    return marshallerFactory.ofMarshalled(dispatchFormat);
  },
  dispatchSizeField: (entryPoint: string): string => `dispatch_size_${entryPoint}`,
};
