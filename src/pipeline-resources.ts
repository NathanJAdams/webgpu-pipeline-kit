import { WGBKBufferFormatKey, WGBKEntityBufferFormats, WGBKMeshBufferResource, WGBKResource, WGBKTrackedBuffer } from './buffer-resource-types';
import { Resources } from './resources';
import { NonMeshBufferLocation, MeshBufferLocation } from './Shaders';
import { WGBKStrides } from './strides';
import { BindGroupDetail, BindGroupsDetail, ComputePipelineDetail, DrawCounts, RenderPipelineDetail, ShaderModuleDetail, VertexBufferDetail } from './types';
import { PipelineUtils, WGBKMesh, WGBKMeshes, WorkGroupSize } from './utils';
import { VertexAttributes } from './vertex-attributes';
import { VertexFormats } from './vertex-formats';

export const PipelineResources = {
  // layouts
  ofBindGroupLayout: (
    name: string,
    entries: GPUBindGroupLayoutEntry[]
  ): WGBKResource<GPUBindGroupLayout> => {
    const label = `${name}-bind-group-layout`;
    return Resources.ofCached({
      get(device, _queue, _encoder) {
        return device.createBindGroupLayout({
          label,
          entries,
        });
      },
    });
  },
  ofPipelineLayout: (
    name: string,
    bindGroupLayoutsResource: WGBKResource<GPUBindGroupLayout[]>
  ): WGBKResource<GPUPipelineLayout> => {
    const label = `${name}-pipeline-layout`;
    return Resources.ofCached({
      get(device, queue, encoder) {
        const bindGroupLayouts = bindGroupLayoutsResource.get(device, queue, encoder);
        return device.createPipelineLayout({
          label,
          bindGroupLayouts,
        });
      },
    });
  },

  // shader
  ofShaderModule: (
    name: string,
    shaderModule: ShaderModuleDetail,
    pipelineLayoutResource: WGBKResource<GPUPipelineLayout>
  ): WGBKResource<GPUShaderModule> => {
    const label = `${name}-shader`;
    const { code, entryPoints } = shaderModule;
    return Resources.ofCachedFromDependencies(
      [pipelineLayoutResource],
      (device, queue, encoder, values) => device.createShaderModule({
        label,
        code,
        compilationHints: entryPoints.map((entryPoint) => ({
          entryPoint,
          layout: values[0],
        })),
      })
    );
  },

  // bind groups
  ofBindGroupEntry: (
    binding: number,
    bufferResource: WGBKResource<WGBKTrackedBuffer>
  ): WGBKResource<GPUBindGroupEntry> => {
    return Resources.ofCachedFromDependencies(
      [bufferResource] as const,
      (device, queue, encoder, values) => ({
        binding,
        resource: {
          buffer: values[0].buffer,
        },
      })
    );
  },
  ofBindGroup: (
    name: string,
    group: number,
    bindGroupLayoutResource: WGBKResource<GPUBindGroupLayout>,
    bindGroupEntriesResource: WGBKResource<GPUBindGroupEntry[]>
  ): WGBKResource<GPUBindGroup> => {
    const label = `${name}-bind-group-${group}`;
    return Resources.ofCachedFromDependencies(
      [bindGroupLayoutResource, bindGroupEntriesResource] as const,
      (device, queue, encoder, values) => device.createBindGroup({
        label,
        layout: values[0],
        entries: values[1],
      })
    );
  },
  ofBindGroupDetail: (
    index: number,
    bindGroupResource: WGBKResource<GPUBindGroup>,
  ): WGBKResource<BindGroupDetail> => {
    return Resources.ofCachedFromDependencies(
      [bindGroupResource],
      (device, queue, encoder, values) => ({
        group: values[0],
        index,
      }),
    );
  },

  // compute
  ofComputePipeline: (
    name: string,
    index: number,
    pipelineLayoutResource: WGBKResource<GPUPipelineLayout>,
    shaderResource: WGBKResource<GPUShaderModule>,
    entryPoint: string
  ): WGBKResource<GPUComputePipeline> => {
    const label = `${name}-compute-pipeline-${index}`;
    return Resources.ofCachedFromDependencies(
      [pipelineLayoutResource, shaderResource] as const,
      (device, queue, encoder, values) => device.createComputePipeline({
        label,
        layout: values[0],
        compute: {
          module: values[1],
          entryPoint,
        },
      })
    );
  },
  ofComputeDetail: (
    bindGroupsResource: WGBKResource<BindGroupsDetail>,
    computePipelineResource: WGBKResource<GPUComputePipeline>,
    workGroupSizeFunc: () => WorkGroupSize
  ): WGBKResource<ComputePipelineDetail> => {
    return Resources.ofCachedFromDependencies(
      [bindGroupsResource, computePipelineResource] as const,
      (device, queue, encoder, values) => ({
        bindGroups: values[0],
        pipeline: values[1],
        workGroupSizeFunc,
      })
    );
  },

  // render
  ofMeshVertexBufferDetail: (
    meshBufferLocation: MeshBufferLocation,
    meshBufferResource: WGBKMeshBufferResource
  ): WGBKResource<VertexBufferDetail> => {
    const { format, location, step } = meshBufferLocation;
    const arrayStride = PipelineUtils.toByteLength(format);
    const attributes: GPUVertexAttribute[] = [{
      format,
      offset: 0,
      shaderLocation: location,
    }];
    return PipelineResources.ofVertexBufferDetail(arrayStride, attributes, location, step, meshBufferResource.vertices);
  },
  ofBindingVertexBufferDetail: <TBufferFormats extends WGBKEntityBufferFormats<any>>(
    bindingBufferLocation: NonMeshBufferLocation<TBufferFormats>,
    bufferFormats: TBufferFormats,
    buffersResources: Record<WGBKBufferFormatKey<TBufferFormats>, WGBKResource<WGBKTrackedBuffer>>,
  ): WGBKResource<VertexBufferDetail> => {
    const { buffer, location, step } = bindingBufferLocation;
    const bufferFormat = bufferFormats[buffer];
    const bufferResource = buffersResources[buffer];
    const { contentType } = bufferFormat;
    const arrayStride = (contentType === 'layout')
      ? WGBKStrides.ofLayout(bufferFormat.layout)
      : WGBKStrides.ofMarshalledFormat(bufferFormat.marshall);
    const attributes = (contentType === 'layout')
      ? VertexAttributes.of(location, bufferFormat.layout, VertexFormats.ofElementLayout, WGBKStrides.ofElementLayout)
      : VertexAttributes.of(location, bufferFormat.marshall, VertexFormats.ofFormatElement, WGBKStrides.ofMarshalledFormatElement);
    return PipelineResources.ofVertexBufferDetail(arrayStride, attributes, location, step, bufferResource);
  },
  ofVertexBufferDetail: (
    arrayStride: number,
    attributes: GPUVertexAttribute[],
    location: number,
    step: GPUVertexStepMode,
    bufferResource: WGBKResource<WGBKTrackedBuffer>
  ): WGBKResource<VertexBufferDetail> => {
    return Resources.ofCachedFromDependencies(
      [bufferResource] as const,
      (_device, _queue, _encoder, values) => ({
        buffer: values[0].buffer,
        layout: {
          arrayStride,
          attributes,
          stepMode: step,
        },
        location,
      })
    );
  },
  ofVertexBuffers: (
    vertexBufferDetailResources: WGBKResource<VertexBufferDetail>[]
  ): WGBKResource<GPUBuffer[]> => {
    return Resources.ofCachedFromDependencies(
      vertexBufferDetailResources,
      (device, queue, encoder, values) => values.map((data) => data.buffer)
    );
  },
  ofVertexBufferLayouts: (
    vertexBufferDetailsResource: WGBKResource<VertexBufferDetail[]>
  ): WGBKResource<GPUVertexBufferLayout[]> => {
    return Resources.ofCachedFromDependencies(
      [vertexBufferDetailsResource] as const,
      (_device, _queue, _encoder, values) => values[0].map((data) => data.layout)
    );
  },
  ofRenderPipeline: (
    name: string,
    index: number,
    mesh: WGBKMesh,
    shaderModuleResource: WGBKResource<GPUShaderModule>,
    vertexShaderEntryPoint: string,
    fragmentShaderEntryPoint: string,
    vertexBufferLayoutsResource: WGBKResource<GPUVertexBufferLayout[]>,
    renderPipelineLayoutResource: WGBKResource<GPUPipelineLayout>,
    isAntiAliasedFunc: () => boolean,
    textureFormatFunc: () => GPUTextureFormat,
  ): WGBKResource<GPURenderPipeline> => {
    const label = `${name}-render-pipeline-${index}`;
    const topology = mesh.topology;
    const frontFace = mesh.winding;
    const cullMode = WGBKMeshes.cullMode(mesh);
    const isAntiAliasedResource: WGBKResource<boolean> = {
      get: (_device, _queue, _encoder) => isAntiAliasedFunc(),
    };
    const textureFormatResource: WGBKResource<GPUTextureFormat> = {
      get: (_device, _queue, _encoder) => textureFormatFunc(),
    };
    return Resources.ofCachedFromDependencies(
      [renderPipelineLayoutResource, shaderModuleResource, vertexBufferLayoutsResource, isAntiAliasedResource, textureFormatResource] as const,
      (device, queue, encoder, values) => device.createRenderPipeline({
        label,
        layout: values[0],
        vertex: {
          module: values[1],
          entryPoint: vertexShaderEntryPoint,
          buffers: values[2],
        },
        fragment: {
          module: values[1],
          entryPoint: fragmentShaderEntryPoint,
          targets: [{
            format: values[4],
          }],
        },
        multisample: {
          count: PipelineUtils.toSampleCount(values[3]),
        },
        primitive: {
          topology,
          frontFace,
          cullMode,
        },
      })
    );
  },
  ofRenderPipelineDetail: (
    indicesType: GPUIndexFormat,
    bindGroupsDetailResource: WGBKResource<BindGroupsDetail>,
    indicesBufferResource: WGBKResource<GPUBuffer>,
    vertexBuffersResource: WGBKResource<GPUBuffer[]>,
    renderPipelineResource: WGBKResource<GPURenderPipeline>,
    drawCountsFunc: () => DrawCounts,
  ): WGBKResource<RenderPipelineDetail> => {
    return Resources.ofCachedFromDependencies(
      [bindGroupsDetailResource, indicesBufferResource, vertexBuffersResource, renderPipelineResource] as const,
      (device, queue, encoder, values) => {
        return ({
          bindGroups: values[0],
          indices: {
            buffer: values[1],
            format: indicesType,
          },
          vertexBuffers: values[2],
          pipeline: values[3],
          drawCountsFunc,
        });
      }
    );
  },
};
