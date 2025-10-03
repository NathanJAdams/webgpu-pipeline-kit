import { DISPATCH_PARAMS_BUFFER_NAME, WPKDispatchParamsDetail, WPKDispatchCount } from './buffer-data';
import { WPKBufferFormatEntityLayout, WPKBufferFormatEntityMarshalled, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatUniform } from './buffer-formats';
import { WPKShaderMatrix, WPKShaderScalar, WPKShaderStruct, WPKShaderVector } from './structs';

//#region options
export type WPKPipelineOptions<TUniform, TEntity, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean> = {
  initialUniform: TUniform;
  initialEntities: TEntity[];
  mutableUniform: TMutableUniform;
  mutableEntities: TMutableEntities;
  resizeableEntities: TResizeableEntities;
};
//#endregion

//#region pipeline
export type WPKPipeline<TUniform, TEntity, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean, TCompute extends boolean, TRender extends boolean> =
  & {
    name: string;
    pipelineDetail: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder) => WPKPipelineDetail<TCompute, TRender>;
    clean: () => void;
  }
  & (TMutableUniform extends true
    ? {
      mutateUniform: (uniform: TUniform) => void
    }
    : object
  )
  & (TMutableEntities extends true
    ? TResizeableEntities extends true
    ? {
      mutateEntityById: (id: string, entity: TEntity) => void
    }
    : {
      mutateEntityByIndex: (index: number, entity: TEntity) => void
    }
    : object
  )
  & (TResizeableEntities extends true
    ? {
      add: (instance: TEntity) => string;
      remove: (instanceId: string) => void;
    }
    : object
  );
//#endregion

//#region details
export type WPKShaderModuleDetail = {
  code: string;
  entryPoints: string[];
};
export type WPKBindGroupDetail = {
  index: number;
  group: GPUBindGroup;
};
export type WPKBindGroupsDetail = Array<WPKBindGroupDetail>;
export type WPKComputePipelineDetail = {
  bindGroups: WPKBindGroupsDetail;
  pipeline: GPUComputePipeline;
  dispatchCount: WPKDispatchCount;
};
export type WPKVertexBufferDetail = {
  buffer: GPUBuffer;
  layout: GPUVertexBufferLayout;
};
export type WPKDrawCounts = {
  indexCount: number;
  instanceCount: number;
};
export type WPKRenderPipelineDetail = {
  bindGroups: WPKBindGroupsDetail;
  pipeline: GPURenderPipeline;
  indices: {
    buffer: GPUBuffer;
    format: GPUIndexFormat;
  };
  vertexBuffers: GPUBuffer[];
  drawCountsFunc: () => WPKDrawCounts;
};
export type WPKReadBackFunc = () => Promise<void>;
export type WPKPipelineDetail<TCompute extends boolean, TRender extends boolean> =
  & {
    name: string;
    instanceCount: number;
    readBackFunc?: WPKReadBackFunc;
  }
  & (
    TCompute extends true
    ? {
      compute: WPKComputePipelineDetail[];
    }
    : object
  )
  & (
    TRender extends true
    ? {
      render: WPKRenderPipelineDetail[];
    }
    : object
  )
  ;
//#endregion

//#region runner
export type WPKAddPipelineOptionsAddBefore = {
  before: string;
};
export type WPKAddPipelineOptionsAddAfter = {
  after: string;
};
export type WPKAddPipelineOptions =
  | WPKAddPipelineOptionsAddBefore
  | WPKAddPipelineOptionsAddAfter
  ;
export type WPKPipelineRunner<TCompute extends boolean, TRender extends boolean> = {
  add: (pipeline: WPKPipeline<any, any, any, any, any, TCompute, TRender>, options?: WPKAddPipelineOptions) => void;
  remove: (name: string) => void;
  step: () => Promise<void>;
  destroy: () => void;
};
//#endregion

//#region views
export type WPKViews = {
  view: GPUTextureView;
  resolveTarget?: GPUTextureView;
};
export type WPKViewsFunc = () => WPKViews;
//#endregion

//#region content
type WPKReadBackContentTypeMap =
  & {
    [S in WPKShaderScalar]: number;
  }
  & {
    [V in WPKShaderVector]: number[];
  }
  & {
    [M in WPKShaderMatrix]: number[];
  };
export type WPKReadBackContent<TStruct extends WPKShaderStruct> = {
  [K in keyof TStruct]: WPKReadBackContentTypeMap[TStruct[K]['datumType']];
};
export type WPKReadBackOptions<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = Partial<{
  onReadBack: (contents: WPKReadBackContentMap<TUniform, TEntity, TBufferFormatMap>) => Promise<void>;
}>;
export type WPKReadBackContentMap<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  [K in WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>]:
  TBufferFormatMap[K] extends WPKBufferFormatUniform<TUniform>
  ? WPKReadBackContent<TBufferFormatMap[K]['marshall']>
  : TBufferFormatMap[K] extends WPKBufferFormatEntityMarshalled<TEntity>
  ? Array<WPKReadBackContent<TBufferFormatMap[K]['marshall']>>
  : TBufferFormatMap[K] extends WPKBufferFormatEntityLayout
  ? Array<WPKReadBackContent<TBufferFormatMap[K]['layout']>>
  : never
  ;
} & {
  [DISPATCH_PARAMS_BUFFER_NAME]: WPKDispatchParamsDetail<any>;
};
//#endregion

//#region invoke
export type WPKPipelineInvoker<TCompute extends boolean, TRender extends boolean> = (encoder: GPUCommandEncoder, index: number, detail: WPKPipelineDetail<TCompute, TRender>) => void;
//#endregion
