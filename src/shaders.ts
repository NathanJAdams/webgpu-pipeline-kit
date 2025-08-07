import { WPKBufferFormatKey, WPKBufferFormatKeyEntity, WPKBufferFormatMap } from './buffer-formats';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { WPKMeshFactoryMap } from './mesh-factory';
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
export type WPKBufferLocationMesh = WPKBufferLocationBase<'mesh', 'vertex'> & {
  format: 'float32x3';
};
export type WPKBufferLocationUserDefined<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = WPKBufferLocationBase<'user-defined', 'instance'> & {
  buffer: WPKBufferFormatKeyEntity<TUniformFormat, TEntityFormat, TBufferFormatMap>;
};
type WPKBufferLocation<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> =
  | WPKBufferLocationMesh
  | WPKBufferLocationUserDefined<TUniformFormat, TEntityFormat, TBufferFormatMap>;
type WPKRenderPassMesh<TMeshFactoryMap extends WPKMeshFactoryMap> = {
  [K in keyof TMeshFactoryMap]: {
    key: K;
    parameters: WPKInstanceOf<TMeshFactoryMap[K]['parameters']>;
  }
}[keyof TMeshFactoryMap];
type WPKRenderPass<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap> = {
  mesh: WPKRenderPassMesh<TMeshFactoryMap>;
  vertex: WPKHasEntryPoint & {
    bufferLocations: Array<WPKBufferLocation<TUniformFormat, TEntityFormat, TBufferFormatMap>>;
  };
  fragment: WPKHasEntryPoint;
};
export type WPKBufferBinding<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  group: number;
  binding: number;
  buffer: WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap>;
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
export type WPKRenderShader<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap> = {
  render: {
    shader: string;
    bufferBindings: Array<WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormatMap>>;
    passes: Array<WPKRenderPass<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>>;
  };
};
export type WPKShader<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap> =
  OneOrBoth<
    WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormatMap>,
    WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>
  >;

export const shaderFuncs = {
  isComputeShader: <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap>(shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>): shader is WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormatMap> => (shader as WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormatMap>).compute !== undefined,
  isRenderShader: <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap>(shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>): shader is WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap> => (shader as WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>).render !== undefined,
};
