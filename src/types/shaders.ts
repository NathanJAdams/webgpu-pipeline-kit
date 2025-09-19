import { WPKBufferFormatEntityLayout, WPKBufferFormatEntityMarshalled, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatMarshalled, WPKBufferFormatUniform } from './buffer-formats';
import { WPKDatumTypeReference, WPKDatumTypeReferenceBase, WPKScalarReference, WPKShaderStructReferences, WPKVectorReference } from './code';
import { WPKMeshParameters, WPKMeshTemplateMap } from './mesh-template';
import { WPKShaderDatumType, WPKShaderDimension, WPKShaderMatrix, WPKShaderScalar, WPKShaderScalarUnsignedInt, WPKShaderStructEntry, WPKShaderVector } from './structs';

type RemoveNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K]
};

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
    atIndex: (index: number | WPKDatumTypeReference<WPKShaderScalarUnsignedInt>) => WPKBufferBindingReferencesEntity<TUniform, TEntity, TBufferFormatMap, TBuffer>;
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
  : never;
export type WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  [TVertexBufferLocation in WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap> as TVertexBufferLocation['buffer']]: {
    [
    TField in TVertexBufferLocation['field']as string extends TField ? 'error' : TField]:
    string extends TField
    ? `To use 'params.vertex_buffers.${TVertexBufferLocation['buffer']}...' ensure TypeScript is version 4.9+ and create the buffer format using 'const ${TVertexBufferLocation['buffer']} = { ... } as const satisifes WPKBufferFormat<MyUniform, MyEntity>;'`
    : WPKStructEntriesDatumType<WPKStructEntries<TUniform, TEntity, TBufferFormatMap, TVertexBufferLocation['buffer']>, TField> extends infer TDatumType
    ? TDatumType extends WPKShaderDatumType
    ? WPKDatumTypeReference<TDatumType>
    : never
    : never
  };
};
//#endregion

//#region wgsl tagged template
export type WPKWgslTaggedTemplate = (strings: TemplateStringsArray, ...values: WPKDatumTypeReferenceBase<WPKShaderDatumType>[]) => string;
//#endregion

//#region render
export type WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>;
  fragment_coordinate: WPKVectorReference<'vec2<f32>'>;
};
export type WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  entryPoint: string;
  code: (params: WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap>, wgsl: WPKWgslTaggedTemplate) => string;
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
  vertex_position: WPKVectorReference<'vec4<f32>'>;
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>;
  vertex_buffers: WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap>;
};
export type WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  entryPoint: string;
  vertexBuffers: Array<WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap>>;
  returnType:
  | 'builtin_position'
  | (string & keyof TBufferFormatMap);
  code: (params: WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap>, wgsl: WPKWgslTaggedTemplate) => string;
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
  code: (params: WPKComputeCodeParams<TUniform, TEntity, TBufferFormatMap>, wgsl: WPKWgslTaggedTemplate) => string;
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
export type WPKVertexBufferEntryType = WPKShaderScalar | WPKShaderVector;
export type WPKVertexBufferLocationTypeScalar = {
  locationType: WPKShaderScalar;
};
export type WPKVertexBufferLocationTypeVector = {
  locationType: WPKShaderVector;
};
export type WPKVertexBufferLocationTypeMatrix = {
  locationType: WPKShaderVector;
  count: WPKShaderDimension;
};
export type WPKVertexBufferLocationType = WPKVertexBufferLocationTypeScalar | WPKVertexBufferLocationTypeVector | WPKVertexBufferLocationTypeMatrix;

export type WPKVertexBufferLocationAttribute = {
  fieldName: string;
  locationName: string;
  type: WPKVertexBufferLocationType;
  attribute: GPUVertexAttribute;
};
export type WPKVertexBufferReconstitutedMatrix = {
  matrixName: string;
  matrixType: WPKShaderMatrix;
  vectorLocationNames: string[];
};
export type WPKVertexBufferAttributeData<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  buffer: string & keyof TBufferFormatMap;
  stride: number;
  locationAttributes: Array<WPKVertexBufferLocationAttribute>;
  reconstitutedMatrices: Array<WPKVertexBufferReconstitutedMatrix>;
};
export type WPKSortedVertexBufferLocationTypes<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = Array<WPKVertexBufferAttributeData<TUniform, TEntity, TBufferFormatMap>>;
export type WPKVertexBufferLocationEntry<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  buffer: string & keyof TBufferFormatMap;
  field: string;
  matrixColumn?: number;
  type: WPKVertexBufferEntryType;
};
//#endregion

//#region shader
type WPKShaderStage<
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
export type WPKShaderStageCompute<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> =
  WPKShaderStage<
    TUniform,
    TEntity,
    TBufferFormatMap,
    true,
    WPKComputePass<TUniform, TEntity, TBufferFormatMap>
  >;
export type WPKShaderStageRender<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap> =
  WPKShaderStage<
    TUniform,
    TEntity,
    TBufferFormatMap,
    false,
    WPKRenderPass<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>
  >;
export type WPKShader<
  TUniform,
  TEntity,
  TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
  TMeshTemplateMap extends WPKMeshTemplateMap
> = {
  compute?: WPKShaderStageCompute<TUniform, TEntity, TBufferFormatMap>;
  render?: WPKShaderStageRender<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>;
};
//#endregion
