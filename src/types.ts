import { WorkGroupSize } from './utils';

export type ShaderModuleDetail = {
    code: string;
    entryPoints: string[];
};
export type BindGroupDetail = {
    index: number;
    group: GPUBindGroup;
};
export type BindGroupsDetail = Array<BindGroupDetail>;
export type ComputePipelineDetail = {
    bindGroups: BindGroupsDetail;
    pipeline: GPUComputePipeline;
    workGroupSizeFunc: () => WorkGroupSize;
};
export type VertexBufferDetail = {
    location: number;
    buffer: GPUBuffer;
    layout: GPUVertexBufferLayout;
};
export type DrawCounts = {
    indexCount: number;
    instanceCount: number;
};
export type RenderPipelineDetail = {
    bindGroups: BindGroupsDetail;
    pipeline: GPURenderPipeline;
    indices: {
        buffer: GPUBuffer;
        format: GPUIndexFormat;
    };
    vertexBuffers: GPUBuffer[];
    drawCountsFunc: () => DrawCounts;
};
export type PipelineDetail = {
    isValid: boolean;
    compute?: ComputePipelineDetail[];
    render?: RenderPipelineDetail[];
};
