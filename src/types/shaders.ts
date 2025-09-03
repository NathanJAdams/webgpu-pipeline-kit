import { NonEmptyArray } from '../utils';
import { WPKBufferFormatKey, WPKBufferFormatMap } from './buffer-formats';
import { WPKMeshParameters, WPKMeshTemplateMap } from './mesh-template';
import { WPKWorkGroupSize } from './pipeline';

//#region data
export type WPKShaderDimension = 2 | 3 | 4;
export type WPKShaderScalarSignedInt = 'i32';
export type WPKShaderScalarUnsignedInt = 'u32';
export type WPKShaderScalarFloat = 'f32';
export type WPKShaderScalar = WPKShaderScalarSignedInt | WPKShaderScalarUnsignedInt | WPKShaderScalarFloat;
export type WPKShaderVectorUntyped = `vec${WPKShaderDimension}`;
export type WPKShaderVector = `${WPKShaderVectorUntyped}<${WPKShaderScalar}>`;
export type WPKShaderMatrixUntyped = `mat${WPKShaderDimension}x${WPKShaderDimension}`;
export type WPKShaderMatrix = `${WPKShaderMatrixUntyped}<f32>`;
export type WPKShaderDatumType = WPKShaderScalar | WPKShaderVector | WPKShaderMatrix;
//#endregion

//#region structs
export type WPKShaderStructEntry<TDatumType extends WPKShaderDatumType = WPKShaderDatumType> = {
  name: string;
  datumType: TDatumType;
};
export type WPKShaderStruct = NonEmptyArray<WPKShaderStructEntry>;
export type WPKShaderStructMap = Record<string, WPKShaderStruct>;
export type WPKShaderStorageAccessMode = 'read' | 'read_write';
export type WPKShaderStructRef<TStructMap extends WPKShaderStructMap> = string & keyof TStructMap;
//#endregion

//#region render
export type WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  bindings: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap>, string>;
  fragment_coordinate: string;
};
export type WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  entryPoint: string;
  code: (params: WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap>) => string;
};
export type WPKRenderPassMesh<TMeshTemplateMap extends WPKMeshTemplateMap> = {
  [K in keyof TMeshTemplateMap]: {
    key: K;
    parameters: WPKMeshParameters<TMeshTemplateMap[K]['parameters']>;
  }
}[keyof TMeshTemplateMap];
export type WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  instance_index: string,
  vertex_index: string,
  vertex_position: string;
  bindings: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap>, string>;
};
export type WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  entryPoint: string;
  returnType:
  | 'builtin_position'
  | (string & keyof TBufferFormatMap);
  code: (params: WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap>) => string;
};
export type WPKRenderPass<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap> = {
  mesh: WPKRenderPassMesh<TMeshTemplateMap>;
  vertex: WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap>;
  fragment: WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap>;
};
//#endregion

//#region compute
export type WPKComputeCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  instance_index: string;
  bindings: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap>, string>;
};
export type WPKComputePass<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  workGroupSize: WPKWorkGroupSize;
  entryPoint: string;
  code: (params: WPKComputeCodeParams<TUniform, TEntity, TBufferFormatMap>) => string;
};
//#endregion

//#region group bindings
export type WPKGroupIndex = 0 | 1 | 2;
export type WPKGroupIndexInternal = WPKGroupIndex | 3;
export type WPKBindingIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type WPKGroupBinding<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  group: WPKGroupIndex;
  binding: WPKBindingIndex;
  buffer: WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap>;
};
export type WPKGroupBindingInternal<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  group: WPKGroupIndexInternal;
  binding: WPKBindingIndex;
  buffer: WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap>;
};
export type WPKGroupBindings<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap>>;
export type WPKGroupBindingsInternal<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = Array<WPKGroupBindingInternal<TUniform, TEntity, TBufferFormatMap>>;
//#endregion

//#region shader
type WPKShaderBase<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TPass> = {
  prologue?: string;
  epilogue?: string;
  groupBindings: WPKGroupBindings<TUniform, TEntity, TBufferFormatMap>;
  passes: Array<TPass>;
};
export type WPKShaderCompute<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = WPKShaderBase<TUniform, TEntity, TBufferFormatMap, WPKComputePass<TUniform, TEntity, TBufferFormatMap>>;
export type WPKShaderRender<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap> = WPKShaderBase<TUniform, TEntity, TBufferFormatMap, WPKRenderPass<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>>;
export type WPKShader<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap> = {
  compute?: WPKShaderCompute<TUniform, TEntity, TBufferFormatMap>;
  render?: WPKShaderRender<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>;
};
//#endregion
