import { HasError, RemoveNever } from '../utils';
import { WPKBufferFormatEntityLayout, WPKBufferFormatEntityMarshalled, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatUniform, WPKBufferFormatVaryings, WPKVaryingsBufferFormat } from './buffer-formats';
import { WPKMeshParameters, WPKMeshTemplateMap } from './mesh-template';
import { WPKDatumTypeReference, WPKDatumTypeReferenceBase, WPKScalarReference, WPKShaderStructReferences, WPKVectorReference } from './shader-code';
import { WPKShaderDatumType, WPKShaderMatrix, WPKShaderScalar, WPKShaderScalarSignedInt, WPKShaderScalarUnsignedInt, WPKShaderVector } from './structs';

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
    atIndex: (index: number | string | WPKScalarReference<WPKShaderScalarSignedInt | WPKShaderScalarUnsignedInt>) => WPKBufferBindingReferencesEntity<TUniform, TEntity, TBufferFormatMap, TBuffer>;
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
//#endregion

//#region wgsl tagged template
export type WPKWgslTaggedTemplate = (strings: TemplateStringsArray, ...values: (number | string | WPKDatumTypeReferenceBase<WPKShaderDatumType>)[]) => string;
//#endregion

//#region render
export type WPKRenderFragmentCodeParamsInputBuiltin = {
  builtin_position: WPKDatumTypeReference<'vec4<f32>'>;
};
export type WPKRenderFragmentCodeParamsInputVaryings<TVaryingsStruct extends WPKBufferFormatVaryings> = {
  [TVaryingsKey in keyof TVaryingsStruct['varyings']]: WPKDatumTypeReference<TVaryingsStruct['varyings'][TVaryingsKey]>
};
export type WPKRenderFragmentCodeParamsInput<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined> =
  TVaryings extends keyof TBufferFormatMap
    ? TBufferFormatMap[TVaryings] extends infer TVaryingsStruct
      ? TVaryingsStruct extends WPKBufferFormatVaryings
        ? TVaryingsStruct extends undefined
          ? HasError<'Struct is undefined'>
          : (
            & WPKRenderFragmentCodeParamsInputBuiltin
            & WPKRenderFragmentCodeParamsInputVaryings<TVaryingsStruct>
          )
        : HasError<'Struct is not varyings'>
      : never
    : HasError<`Varyings ${TVaryings} layout is not contained in buffer format map`>
    ;
export type WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined> = {
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>;
  input: TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap>
  ? WPKRenderFragmentCodeParamsInput<TUniform, TEntity, TBufferFormatMap, TVaryings>
  : WPKDatumTypeReference<'vec4<f32>'>
};
export type WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined> = {
  entryPoint: string;
  input: TVaryings;
  code: (wgsl: WPKWgslTaggedTemplate, params: WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap, TVaryings>) => string;
};
export type WPKRenderPassMesh<TMeshTemplateMap extends WPKMeshTemplateMap> = {
  [K in keyof TMeshTemplateMap]: {
    key: K;
    parameters: WPKMeshParameters<TMeshTemplateMap[K]['parameters']>;
  }
}[keyof TMeshTemplateMap];
export type WPKRenderVertexCodeParamsNoOutput<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  builtin_instance_index: WPKScalarReference<'u32'>,
  builtin_vertex_index: WPKScalarReference<'u32'>,
  vertex_position: WPKVectorReference<'vec3<f32>'>;
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>;
  vertex_buffers: WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap>;
};
export type WPKRenderVertexCodeParamsOutput = {
  output: {
    type: string;
  }
};
export type WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined> =
  & WPKRenderVertexCodeParamsNoOutput<TUniform, TEntity, TBufferFormatMap>
  & (TVaryings extends undefined
    ? object
    : TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap>
    ? WPKRenderVertexCodeParamsOutput
    : object
  );
export type WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined> = {
  entryPoint: string;
  vertexBuffers: Array<WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap>>;
  output: TVaryings;
  code: (wgsl: WPKWgslTaggedTemplate, params: WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap, TVaryings>) => string;
};
export type WPKRenderPass<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined> = {
  mesh: WPKRenderPassMesh<TMeshTemplateMap>;
  vertex: WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap, TVaryings>;
  fragment: WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap, TVaryings>;
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
    field: string & TBufferFormatMap[K]['marshall']['name'];
  }
  : TBufferFormatMap[K] extends WPKBufferFormatEntityLayout
  ? {
    buffer: K;
    field: string & TBufferFormatMap[K]['layout']['name'];
  }
  : never
}[string & keyof TBufferFormatMap];
export type WPKVertexBufferFieldReferences<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TBufferName extends string & keyof TBufferFormatMap> =
  TBufferFormatMap[TBufferName] extends infer TBufferFormat
  ? TBufferFormat extends WPKBufferFormatEntityMarshalled<TEntity>
  ? {
    [TFieldName in string & keyof TBufferFormat['marshall']]:
    WPKDatumTypeReference<TBufferFormat['marshall'][TFieldName]['datumType']>
  }
  : TBufferFormat extends WPKBufferFormatEntityLayout
  ? {
    [TFieldName in string & keyof TBufferFormat['layout']]:
    WPKDatumTypeReference<TBufferFormat['layout'][TFieldName]['datumType']>
  }
  : never
  : never
  ;
export type WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = RemoveNever<{
  [TBufferName in string & keyof TBufferFormatMap]: WPKVertexBufferFieldReferences<TUniform, TEntity, TBufferFormatMap, TBufferName>
}>;
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
export type WPKRenderShader<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined> =
  WPKShaderStage<
    TUniform,
    TEntity,
    TBufferFormatMap,
    false,
    WPKRenderPass<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap, TVaryings>
  >;
//#endregion
