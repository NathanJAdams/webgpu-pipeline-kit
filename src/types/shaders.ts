import { HasError, RemoveNever } from '../utils';
import { WPKBufferFormatEntityLayout, WPKBufferFormatEntityMarshalled, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatMarshalled, WPKBufferFormatUniform } from './buffer-formats';
import { WPKMeshParameters, WPKMeshTemplateMap } from './mesh-template';
import { WPKDatumTypeReference, WPKDatumTypeReferenceBase, WPKScalarReference, WPKShaderStructReferences, WPKVectorReference } from './shader-code';
import { WPKShaderDatumType, WPKShaderMatrix, WPKShaderScalar, WPKShaderScalarSignedInt, WPKShaderScalarUnsignedInt, WPKShaderStructEntry, WPKShaderVector } from './structs';

//#region references
export type WPKBufferBindingReferencesEntity<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TBuffer extends keyof TBufferFormatMap> =
  TBufferFormatMap[TBuffer] extends WPKBufferFormatEntityMarshalled<TEntity>
  ? WPKShaderStructReferences<TBufferFormatMap[TBuffer]['marshall']>
  : TBufferFormatMap[TBuffer] extends WPKBufferFormatEntityLayout
  ? WPKShaderStructReferences<TBufferFormatMap[TBuffer]['layout']>
  : never
  ;
export type WPKBufferBindingReferencesEntityIndexable<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TBuffer extends keyof TBufferFormatMap> =
  & {
    atIndex: (index: number | string | WPKDatumTypeReference<WPKShaderScalarSignedInt | WPKShaderScalarUnsignedInt>) => WPKBufferBindingReferencesEntity<TUniform, TEntity, TBufferFormatMap, TBuffer>;
  }
  & WPKBufferBindingReferencesEntity<TUniform, TEntity, TBufferFormatMap, TBuffer>
  ;
export type WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeUniform extends boolean, TIncludeEntity extends boolean> =
  RemoveNever<{
    [TBuffer in string & keyof TBufferFormatMap]:
    | (
      TIncludeUniform extends true
      ? TBufferFormatMap[TBuffer] extends WPKBufferFormatUniform<TUniform>
      ? WPKShaderStructReferences<TBufferFormatMap[TBuffer]['marshall']>
      : never
      : never
    )
    | (
      TIncludeEntity extends true
      ? WPKBufferBindingReferencesEntityIndexable<TUniform, TEntity, TBufferFormatMap, TBuffer>
      : never
    )
  }>;
type WPKStructEntriesDatumType<TStructEntries extends readonly WPKShaderStructEntry[], TStructEntryName> =
  TStructEntries extends [infer Head, ...infer Tail]
  ? Head extends WPKShaderStructEntry<infer TDatumType>
  ? TDatumType
  : WPKStructEntriesDatumType<Tail extends readonly WPKShaderStructEntry[] ? Tail : never, TStructEntryName>
  : never;
type WPKStructEntries<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TBufferName extends keyof TBufferFormatMap> =
  TBufferFormatMap[TBufferName] extends WPKBufferFormatMarshalled<any, any, any>
  ? TBufferFormatMap[TBufferName]['marshall']
  : TBufferFormatMap[TBufferName] extends WPKBufferFormatEntityLayout
  ? TBufferFormatMap[TBufferName]['layout']
  : HasError<'No struct entries possible'>;
export type WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  [TVertexBufferLocation in WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap> as TVertexBufferLocation['buffer']]: {
    [
    TField in TVertexBufferLocation['field']as string extends TField ? 'error' : TField]:
    string extends TField
    ? `To use 'params.vertex_buffers.${TVertexBufferLocation['buffer']}...' ensure TypeScript is version 4.9+ and create the buffer format using 'const ${TVertexBufferLocation['buffer']} = { ... } as const satisifes WPKBufferFormat<MyUniform, MyEntity>;'`
    : WPKStructEntries<TUniform, TEntity, TBufferFormatMap, TVertexBufferLocation['buffer']> extends infer TStructEntries
    ? TStructEntries extends HasError<any>
    ? TStructEntries
    : TStructEntries extends WPKShaderStructEntry[]
    ? WPKStructEntriesDatumType<TStructEntries, TField> extends infer TDatumType
    ? TDatumType extends never
    ? HasError<'No datum type found'>
    : TDatumType extends WPKShaderDatumType
    ? WPKDatumTypeReference<TDatumType>
    : HasError<'Invalid datum type'>
    : HasError<'Internal error'>
    : HasError<'Invalid struct entries'>
    : HasError<'Internal error'>
  };
};
//#endregion

//#region wgsl tagged template
export type WPKWgslTaggedTemplate = (strings: TemplateStringsArray, ...values: (number | string | WPKDatumTypeReferenceBase<WPKShaderDatumType>)[]) => string;
//#endregion

//#region render
export type WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>;
  fragment_coordinate: WPKVectorReference<'vec2<f32>'>;
};
export type WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  entryPoint: string;
  code: (wgsl: WPKWgslTaggedTemplate, params: WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap>) => string;
};
export type WPKRenderPassMesh<TMeshTemplateMap extends WPKMeshTemplateMap> = {
  [K in keyof TMeshTemplateMap]: {
    key: K;
    parameters: WPKMeshParameters<TMeshTemplateMap[K]['parameters']>;
  }
}[keyof TMeshTemplateMap];
export type WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  instance_index: WPKScalarReference<'u32'>,
  vertex_index: WPKScalarReference<'u32'>,
  vertex_position: WPKVectorReference<'vec3<f32>'>;
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>;
  vertex_buffers: WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap>;
};
export type WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  entryPoint: string;
  vertexBuffers: Array<WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap>>;
  returnType:
  | 'builtin_position'
  | (string & keyof TBufferFormatMap);
  code: (wgsl: WPKWgslTaggedTemplate, params: WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap>) => string;
};
export type WPKRenderPass<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap> = {
  mesh: WPKRenderPassMesh<TMeshTemplateMap>;
  vertex: WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap>;
  fragment: WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap>;
};
//#endregion

//#region compute
export type WPKWorkGroupSize = {
  x: number;
  y?: number;
  z?: number;
};
export type WPKComputeCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  instance_index: WPKDatumTypeReference<'u32'>;
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, true>;
};
export type WPKComputePass<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  workGroupSize: WPKWorkGroupSize;
  entryPoint: string;
  code: (wgsl: WPKWgslTaggedTemplate, params: WPKComputeCodeParams<TUniform, TEntity, TBufferFormatMap>) => string;
};
//#endregion

//#region group bindings
export type WPKGroupIndex = 0 | 1 | 2;
export type WPKBindingIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WPKGroupBinding<
  TUniform,
  TEntity,
  TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
  TIncludeUniform extends boolean,
  TIncludeEntity extends boolean
> = {
  group: WPKGroupIndex;
  binding: WPKBindingIndex;
  buffer: WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, TIncludeUniform, TIncludeEntity>;
};
export type WPKGroupBindingCompute<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, true, true>;
export type WPKGroupBindingRender<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, true, false>;
//#endregion

//#region vertex buffer locations
export type WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  [K in string & keyof TBufferFormatMap]:
  TBufferFormatMap[K] extends WPKBufferFormatEntityMarshalled<TEntity>
  ? {
    buffer: K;
    field: string & TBufferFormatMap[K]['marshall'][number]['name'];
  }
  : TBufferFormatMap[K] extends WPKBufferFormatEntityLayout
  ? {
    buffer: K;
    field: string & TBufferFormatMap[K]['layout'][number]['name'];
  }
  : never
}[string & keyof TBufferFormatMap];
export type WPKVertexBufferDataTypes = WPKShaderScalar | WPKShaderVector | WPKShaderVector[];
export type WPKVertexBufferLocationType = WPKShaderScalar | WPKShaderVector;

export type WPKVertexBufferLocationAttribute = {
  fieldName: string;
  locationName: string;
  datumType: WPKShaderDatumType;
  attribute: GPUVertexAttribute;
};
export type WPKVertexBufferReconstitutedMatrix = {
  matrixName: string;
  matrixType: WPKShaderMatrix;
  vectorLocationNames: string[];
};
export type WPKVertexBufferReference = {
  name: string;
  reference: string;
  datumType: WPKShaderDatumType;
};
export type WPKVertexBufferAttributeData<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  buffer: string & keyof TBufferFormatMap;
  stride: number;
  locationAttributes: Array<WPKVertexBufferLocationAttribute>;
  reconstitutedMatrices: Array<WPKVertexBufferReconstitutedMatrix>;
  references: Array<WPKVertexBufferReference>;
};
export type WPKSortedVertexBufferLocationTypes<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = Array<WPKVertexBufferAttributeData<TUniform, TEntity, TBufferFormatMap>>;
export type WPKVertexBufferLocationEntry<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  buffer: string & keyof TBufferFormatMap;
  field: string;
  matrixColumn?: number;
  type: WPKVertexBufferLocationType;
};
//#endregion

//#region shader
export type WPKShaderStage<
  TUniform,
  TEntity,
  TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
  TIncludeEntity extends boolean,
  TPass
> = {
  prologue?: string;
  epilogue?: string;
  groupBindings: Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, true, TIncludeEntity>>;
  passes: Array<TPass>;
};
export type WPKComputeShader<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> =
  WPKShaderStage<
    TUniform,
    TEntity,
    TBufferFormatMap,
    true,
    WPKComputePass<TUniform, TEntity, TBufferFormatMap>
  >;
export type WPKRenderShader<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap> =
  WPKShaderStage<
    TUniform,
    TEntity,
    TBufferFormatMap,
    false,
    WPKRenderPass<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>
  >;
//#endregion
