import { WPKBufferFormatMap } from './buffer-formats';
import { WPKMeshTemplateMap } from './mesh-template';
import { WPKShader } from './shaders';
import { Color } from '../utils';

//#region definition
export type WPKPipelineDefinition<
  TUniform,
  TEntity,
  TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
  TMeshTemplateMap extends WPKMeshTemplateMap,
> = {
  name: string;
  bufferFormats: TBufferFormatMap;
  meshFactories: TMeshTemplateMap;
  shader: WPKShader<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>;
};
//#endregion

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
export type WPKPipeline<TUniform, TEntity, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean> =
  {
    name: string;
    pipelineDetail: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder, options: WPKPipelineDetailOptions) => WPKPipelineDetail;
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
export type WPKPipelineDetailOptions = {
  isAntiAliased: boolean;
  textureFormat: GPUTextureFormat;
};
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
  location: number;
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
export type WPKPipelineDetail = {
  name: string;
  instanceCount: number;
  compute?: WPKComputePipelineDetail[];
  render?: WPKRenderPipelineDetail[];
};
//#endregion

//#region dispatch
export type WPKDispatchSize = [number, number, number];
export type WPKDispatchParams = {
  instanceCount: number;
  dispatchSize: WPKDispatchSize;
};
//#endregion

//#region display
export type WPKDisplayAddPipelineOptionsAddBefore = {
  before: string;
};
export type WPKDisplayAddPipelineOptionsAddAfter = {
  after: string;
};
export type WPKDisplayAddPipelineOptions =
  | WPKDisplayAddPipelineOptionsAddBefore
  | WPKDisplayAddPipelineOptionsAddAfter
  ;
export type WPKDisplayOptions = {
  clear: Color;
  isAntiAliased: boolean;
};
export type WPKDisplay = {
  add: (pipeline: WPKPipeline<any, any, any, any, any>, options?: WPKDisplayAddPipelineOptions) => void;
  remove: (name: string) => void;
  display: (options: WPKDisplayOptions) => Promise<void>;
};
//#endregion

//#region views
export type WPKViews = {
  view: GPUTextureView;
  resolveTarget?: GPUTextureView;
};
export type WPKViewsFunc = (isAntiAliased: boolean) => WPKViews;
//#endregion
