import { WorkGroupSize } from './pipeline-utils';

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
    workGroupSizeFunc: () => WorkGroupSize;
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
    isValid: boolean;
    compute?: WPKComputePipelineDetail[];
    render?: WPKRenderPipelineDetail[];
};
