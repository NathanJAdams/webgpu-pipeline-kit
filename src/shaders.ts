import { WPKBufferFormatKey, WPKBufferFormatMap } from './buffer-format';
import { WPKMesh } from './mesh';
import { WPKWorkGroupSize } from './pipeline-utils';
import { OneOrBoth } from './utils';

type WPKHasEntryPoint = {
  entryPoint: string;
};

type WPKBufferLocation<TType, TStep> = {
  type: TType;
  location: number;
  step: TStep;
};
export type WPKMeshBufferLocation = WPKBufferLocation<'mesh', 'vertex'> & {
  format: 'float32x3';
};
export type WPKUserDefinedBufferLocation<TBufferFormats extends WPKBufferFormatMap<any, any>> = WPKBufferLocation<'user-defined', 'instance'> & {
  buffer: WPKBufferFormatKey<TBufferFormats>;
};

type WPKComputePass = WPKHasEntryPoint & {
  workGroupSize: WPKWorkGroupSize;
};
type WPKRenderPass<TBufferFormats extends WPKBufferFormatMap<any, any>> = {
  vertex: WPKHasEntryPoint & {
    bufferLocations: Array<WPKMeshBufferLocation | WPKUserDefinedBufferLocation<TBufferFormats>>;
  };
  fragment: WPKHasEntryPoint;
};
export type WPKBufferBinding<TBufferFormats extends WPKBufferFormatMap<any, any>> = {
  group: number;
  binding: number;
  buffer: WPKBufferFormatKey<TBufferFormats>;
};
export type WPKComputeShader<TBufferFormats extends WPKBufferFormatMap<any, any>> = {
  compute: {
    shader: string;
    bufferBindings: Array<WPKBufferBinding<TBufferFormats>>;
    passes: Array<WPKComputePass>;
  }
};
export type WPKRenderShader<TBufferFormats extends WPKBufferFormatMap<any, any>> = {
  render: {
    shader: string;
    bufferBindings: Array<WPKBufferBinding<TBufferFormats>>;
    passes: Array<WPKRenderPass<TBufferFormats>>;
    mesh: WPKMesh;
  };
};
export type WPKShader<TBufferFormats extends WPKBufferFormatMap<any, any>> = OneOrBoth<WPKComputeShader<TBufferFormats>, WPKRenderShader<TBufferFormats>>;

export const shaderFuncs = {
  isComputeShader: <TBufferFormats extends WPKBufferFormatMap<any, any>>(shader: WPKShader<TBufferFormats>): shader is WPKComputeShader<TBufferFormats> => (shader as WPKComputeShader<TBufferFormats>).compute !== undefined,
  isRenderShader: <TBufferFormats extends WPKBufferFormatMap<any, any>>(shader: WPKShader<TBufferFormats>): shader is WPKRenderShader<TBufferFormats> => (shader as WPKRenderShader<TBufferFormats>).render !== undefined,
};
