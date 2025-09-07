import { WPKBufferFormatEntityLayout, WPKBufferFormatEntityMarshalled, WPKBufferFormatKey, WPKBufferFormatMap } from './buffer-formats';
import { WPKMeshParameters, WPKMeshTemplateMap } from './mesh-template';
import { WPKShaderDimension, WPKShaderMatrix, WPKShaderScalar, WPKShaderVector } from './structs';

//#region render
export type WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  bindings: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, true, false>, string>;
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
  bindings: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, true, false>, string>;
}
  & (
    string extends WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap>['field']
    ? object
    : {
      vertex_buffers: Record<
        `${WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap>['buffer']}`,
        Record<
          `${WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap>['field']}`,
          string
        >
      >;
    }
  );
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
  >
  & {
    vertexBuffers: Array<WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap>>;
  };
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
