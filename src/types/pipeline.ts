import { DISPATCH_PARAMS_BUFFER_NAME, WPKDispatchParams, WPKDispatchSize } from './buffer-data';
import { WPKBufferFormatEntityLayout, WPKBufferFormatEntityMarshalled, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatUniform } from './buffer-formats';

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
  dispatchSize: WPKDispatchSize;
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
export type WPKDebugFunc = () => Promise<void>;
export type WPKPipelineDetail<TCompute extends boolean, TRender extends boolean> =
  & {
    name: string;
    instanceCount: number;
    debugFunc?: WPKDebugFunc;
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
  destroy:()=>void;
};
//#endregion

//#region views
export type WPKViews = {
  view: GPUTextureView;
  resolveTarget?: GPUTextureView;
};
export type WPKViewsFunc = () => WPKViews;
//#endregion

//#region debug
export type WPKDebugOptions<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = Partial<{
  onBufferContents: (contents: WPKDebugBufferContentMap<TUniform, TEntity, TBufferFormatMap>) => Promise<void>;
}>;
export type WPKDebugBufferContentMap<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  [K in WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>]:
  TBufferFormatMap[K] extends WPKBufferFormatUniform<TUniform>
  ? Partial<TUniform>
  : TBufferFormatMap[K] extends WPKBufferFormatEntityMarshalled<TEntity>
  ? Array<Partial<TEntity>>
  : TBufferFormatMap[K] extends WPKBufferFormatEntityLayout
  ? Array<{
    [F in TBufferFormatMap[K]['layout'][number]['name']]: number | number[] | string;
  }>
  : never
  ;
} & {
  [DISPATCH_PARAMS_BUFFER_NAME]: WPKDispatchParams<any>;
};
//#endregion

//#region invoke
export type WPKPipelineInvoker<TCompute extends boolean, TRender extends boolean> = (encoder: GPUCommandEncoder, index: number, detail: WPKPipelineDetail<TCompute, TRender>) => void;
//#endregion
