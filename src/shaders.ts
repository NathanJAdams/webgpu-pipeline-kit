import { WPKBufferFormatKey, WPKBufferFormatKeyEntity, WPKBufferFormatMap } from './buffer-formats';
import { WPKInstanceFormat } from './instance';
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
export type WPKUserDefinedBufferLocation<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = WPKBufferLocation<'user-defined', 'instance'> & {
  buffer: WPKBufferFormatKeyEntity<TUniformFormat, TEntityFormat, TBufferFormats>;
};

type WPKComputePass = WPKHasEntryPoint & {
  workGroupSize: WPKWorkGroupSize;
};
type WPKRenderPass<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  vertex: WPKHasEntryPoint & {
    bufferLocations: Array<WPKMeshBufferLocation | WPKUserDefinedBufferLocation<TUniformFormat, TEntityFormat, TBufferFormats>>;
  };
  fragment: WPKHasEntryPoint;
};
export type WPKBufferBinding<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  group: number;
  binding: number;
  buffer: WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>;
};
export type WPKComputeShader<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  compute: {
    shader: string;
    bufferBindings: Array<WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormats>>;
    passes: Array<WPKComputePass>;
  }
};
export type WPKRenderShader<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  render: {
    shader: string;
    bufferBindings: Array<WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormats>>;
    passes: Array<WPKRenderPass<TUniformFormat, TEntityFormat, TBufferFormats>>;
    mesh: WPKMesh;
  };
};
export type WPKShader<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> =
  OneOrBoth<
    WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormats>,
    WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormats>
  >;

export const shaderFuncs = {
  isComputeShader: <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormats>): shader is WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormats> => (shader as WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormats>).compute !== undefined,
  isRenderShader: <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormats>): shader is WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormats> => (shader as WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormats>).render !== undefined,
};
