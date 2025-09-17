import { WPKBufferFormatEntityLayout, WPKBufferFormatEntityMarshalled, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatUniform } from './buffer-formats';
import { WPKMatrixIndices, WPKSwizzle } from './code';
import { WPKMeshParameters, WPKMeshTemplateMap } from './mesh-template';
import { WPKShaderDatumType, WPKShaderDimension, WPKShaderDimensionMap, WPKShaderMatrix, WPKShaderScalar, WPKShaderScalarUnsignedInt, WPKShaderStruct, WPKShaderVector, WPKShaderVectorOfDimensionType } from './structs';

//#region util
type RemoveNeverKeys<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};
//#endregion

//#region references
type WPKBufferBindingReferenceValue<TDatumType extends WPKShaderDatumType> = string & { __brand: TDatumType; };
type WPKBufferBindingReferenceValuesVector<TVectorLength extends WPKShaderDimension, TComponentType extends WPKShaderScalar> =
  & {
    [TSwizzle in WPKSwizzle<TVectorLength, 1>]: WPKBufferBindingReferenceValue<TComponentType>
  }
  & {
    [TSwizzle in WPKSwizzle<TVectorLength, 2>]: WPKBufferBindingReferenceValue<WPKShaderVectorOfDimensionType<2, TComponentType>>
  }
  & (TVectorLength extends (3 | 4)
    ? {
      [TSwizzle in WPKSwizzle<TVectorLength, 3>]: WPKBufferBindingReferenceValue<WPKShaderVectorOfDimensionType<3, TComponentType>>
    }
    : object
  )
  & (TVectorLength extends (4)
    ? {
      [TSwizzle in WPKSwizzle<TVectorLength, 4>]: WPKBufferBindingReferenceValue<WPKShaderVectorOfDimensionType<4, TComponentType>>
    }
    : object
  )
  ;
type WPKBufferBindingReferenceValues<TShaderStruct extends WPKShaderStruct> = {
  [TField in TShaderStruct[number]as string & TField['name']]:
  TField['datumType'] extends WPKShaderScalar
  ? WPKBufferBindingReferenceValue<TField['datumType']>
  : TField['datumType'] extends `vec${infer TLengthName}<${infer TComponentType}>`
  ? TLengthName extends keyof WPKShaderDimensionMap
  ? TComponentType extends WPKShaderScalar
  ? WPKBufferBindingReferenceValuesVector<WPKShaderDimensionMap[TLengthName], TComponentType>
  : never
  : never
  : TField['datumType'] extends `mat${infer TColumnsName}x${infer TRowsName}<${infer TComponentType}>`
  ? TColumnsName extends keyof WPKShaderDimensionMap
  ? TRowsName extends keyof WPKShaderDimensionMap
  ? TComponentType extends WPKShaderScalar
  ? Record<WPKMatrixIndices<WPKShaderDimensionMap[TColumnsName], WPKShaderDimensionMap[TRowsName]>, WPKBufferBindingReferenceValue<TComponentType>>
  : never
  : never
  : never
  : never
};
export type WPKBufferBindingReferencesEntity<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TBuffer extends keyof TBufferFormatMap> =
  TBufferFormatMap[TBuffer] extends WPKBufferFormatEntityMarshalled<TEntity>
  ? WPKBufferBindingReferenceValues<TBufferFormatMap[TBuffer]['marshall']>
  : TBufferFormatMap[TBuffer] extends WPKBufferFormatEntityLayout
  ? WPKBufferBindingReferenceValues<TBufferFormatMap[TBuffer]['layout']>
  : never
  ;
export type WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeUniform extends boolean, TIncludeEntity extends boolean> =
  RemoveNeverKeys<{
    [TBuffer in string & keyof TBufferFormatMap]:
    | (
      TIncludeUniform extends true
      ? TBufferFormatMap[TBuffer] extends WPKBufferFormatUniform<TUniform>
      ? WPKBufferBindingReferenceValues<TBufferFormatMap[TBuffer]['marshall']>
      : never
      : never
    )
    | (
      TIncludeEntity extends true
      ? (
        & WPKBufferBindingReferencesEntity<TUniform, TEntity, TBufferFormatMap, TBuffer>
        & {
          atIndex: (index: number | WPKBufferBindingReferenceValue<WPKShaderScalarUnsignedInt>) => WPKBufferBindingReferencesEntity<TUniform, TEntity, TBufferFormatMap, TBuffer>;
        }
      )
      : never
    )
  }>;
export type WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  [TVertexBufferLocation in WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap> as TVertexBufferLocation['buffer']]: {
    [
    TField in TVertexBufferLocation['field']as string extends TField
    ? 'error'
    : TField
    ]: string extends TField
    ? `To use 'params.vertex_buffers.${TVertexBufferLocation['buffer']}...' ensure TypeScript is version 4.9+ and create the buffer format using 'const ${TVertexBufferLocation['buffer']} = { ... } as const satisifes WPKBufferFormat<MyUniform, MyEntity>;'`
    : TField;
  };
};
//#endregion

//#region render
export type WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>;
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
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>;
  vertex_buffers: WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap>;
};
export type WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  entryPoint: string;
  vertexBuffers: Array<WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap>>;
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
export type WPKWorkGroupSize = {
  x: number;
  y?: number;
  z?: number;
};
export type WPKComputeCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  instance_index: string;
  bindings: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, true, true>, string>;
};
export type WPKComputePass<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  workGroupSize: WPKWorkGroupSize;
  entryPoint: string;
  code: (params: WPKComputeCodeParams<TUniform, TEntity, TBufferFormatMap>) => string;
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
