import { WPKBufferFormatKey, WPKBufferFormatKeyEntity, WPKBufferFormatMap } from './buffer-formats';
import { WPKInstanceFormat } from './instance';
import { WPKMesh } from './mesh';
import { WPKWorkGroupSize } from './pipeline-utils';
import { OneOrBoth } from './utils';

type WPKHasEntryPoint = {
  entryPoint: string;
};
type WPKBufferLocationType = 'mesh' | 'user-defined';
type WPKBufferLocationStep = 'vertex' | 'instance';
type WPKBufferLocationBase<TType extends WPKBufferLocationType, TStep extends WPKBufferLocationStep> = {
  type: TType;
  location: number;
  step: TStep;
};
export type WPKForeignBufferRef<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  formats: TBufferFormatMap;
  key: WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap>;
};
export type WPKBufferLocationMesh = WPKBufferLocationBase<'mesh', 'vertex'> & {
  format: 'float32x3';
};
export type WPKBufferLocationUserDefined<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = WPKBufferLocationBase<'user-defined', 'instance'> & {
  buffer: WPKBufferFormatKeyEntity<TUniformFormat, TEntityFormat, TBufferFormatMap>;
};
type WPKBufferLocation<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> =
  | WPKBufferLocationMesh
  | WPKBufferLocationUserDefined<TUniformFormat, TEntityFormat, TBufferFormatMap>;
type WPKRenderPass<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  vertex: WPKHasEntryPoint & {
    bufferLocations: Array<WPKBufferLocation<TUniformFormat, TEntityFormat, TBufferFormatMap>>;
  };
  fragment: WPKHasEntryPoint;
};
type WPKBufferBindingRef<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> =
  | WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap>
  | WPKForeignBufferRef<any, any, any>;
export type WPKBufferBinding<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  group: number;
  binding: number;
  buffer: WPKBufferBindingRef<TUniformFormat, TEntityFormat, TBufferFormatMap>;
};
type WPKComputePass = WPKHasEntryPoint & {
  workGroupSize: WPKWorkGroupSize;
};
export type WPKComputeShader<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  compute: {
    shader: string;
    bufferBindings: Array<WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormatMap>>;
    passes: Array<WPKComputePass>;
  }
};
export type WPKRenderShader<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  render: {
    shader: string;
    bufferBindings: Array<WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormatMap>>;
    passes: Array<WPKRenderPass<TUniformFormat, TEntityFormat, TBufferFormatMap>>;
    mesh: WPKMesh;
  };
};
export type WPKShader<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> =
  OneOrBoth<
    WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormatMap>,
    WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap>
  >;

export const shaderFactory = {
  ofForeignBufferRef: <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(_foreignUniformFormat: TUniformFormat, _foreignEntityFormat: TEntityFormat, foreignBufferFormats: TBufferFormatMap, key: WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap>): WPKForeignBufferRef<TUniformFormat, TEntityFormat, TBufferFormatMap> => ({ formats: foreignBufferFormats, key }),
};
export const shaderFuncs = {
  isBufferBindingRefNative: <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(bufferBindingRef: WPKBufferBindingRef<TUniformFormat, TEntityFormat, TBufferFormatMap>): bufferBindingRef is WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap> => typeof bufferBindingRef === 'string',
  isComputeShader: <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormatMap>): shader is WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormatMap> => (shader as WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormatMap>).compute !== undefined,
  isRenderShader: <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormatMap>): shader is WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap> => (shader as WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap>).render !== undefined,
};
