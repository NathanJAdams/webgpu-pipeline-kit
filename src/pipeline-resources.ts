import { WPKBufferFormatKey, WPKEntityBufferFormats, WPKMeshBufferResource, WPKResource, WPKTrackedBuffer } from './buffer-types';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKComputePipelineDetail, WPKDrawCounts, WPKRenderPipelineDetail, WPKShaderModuleDetail, WPKVertexBufferDetail } from './detail-types';
import { WPKMesh, meshFuncs } from './mesh';
import { pipelineFuncs, WPKWorkGroupSize } from './pipeline-utils';
import { resourceFactory } from './resources';
import { WPKUserDefinedBufferLocation, WPKMeshBufferLocation } from './shaders';
import { strideFuncs } from './strides';
import { vertexAttributesFactory } from './vertex-attributes';
import { vertexFormatsFactory } from './vertex-formats';

export const pipelineResourceFactory = {
  // layouts
  ofBindGroupLayout: (
    name: string,
    entries: GPUBindGroupLayoutEntry[]
  ): WPKResource<GPUBindGroupLayout> => {
    const label = `${name}-bind-group-layout`;
    return resourceFactory.ofCached({
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
    bindGroupLayoutsResource: WPKResource<GPUBindGroupLayout[]>
  ): WPKResource<GPUPipelineLayout> => {
    const label = `${name}-pipeline-layout`;
    return resourceFactory.ofCached({
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
    shaderModule: WPKShaderModuleDetail,
    pipelineLayoutResource: WPKResource<GPUPipelineLayout>
  ): WPKResource<GPUShaderModule> => {
    const label = `${name}-shader`;
    const { code, entryPoints } = shaderModule;
    return resourceFactory.ofCachedFromDependencies(
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
    bufferResource: WPKResource<WPKTrackedBuffer>
  ): WPKResource<GPUBindGroupEntry> => {
    return resourceFactory.ofCachedFromDependencies(
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
    bindGroupLayoutResource: WPKResource<GPUBindGroupLayout>,
    bindGroupEntriesResource: WPKResource<GPUBindGroupEntry[]>
  ): WPKResource<GPUBindGroup> => {
    const label = `${name}-bind-group-${group}`;
    return resourceFactory.ofCachedFromDependencies(
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
    bindGroupResource: WPKResource<GPUBindGroup>,
  ): WPKResource<WPKBindGroupDetail> => {
    return resourceFactory.ofCachedFromDependencies(
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
    pipelineLayoutResource: WPKResource<GPUPipelineLayout>,
    shaderResource: WPKResource<GPUShaderModule>,
    entryPoint: string
  ): WPKResource<GPUComputePipeline> => {
    const label = `${name}-compute-pipeline-${index}`;
    return resourceFactory.ofCachedFromDependencies(
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
    bindGroupsResource: WPKResource<WPKBindGroupsDetail>,
    computePipelineResource: WPKResource<GPUComputePipeline>,
    workGroupSizeFunc: () => WPKWorkGroupSize
  ): WPKResource<WPKComputePipelineDetail> => {
    return resourceFactory.ofCachedFromDependencies(
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
    meshBufferLocation: WPKMeshBufferLocation,
    meshBufferResource: WPKMeshBufferResource
  ): WPKResource<WPKVertexBufferDetail> => {
    const { format, location, step } = meshBufferLocation;
    const arrayStride = pipelineFuncs.toByteLength(format);
    const attributes: GPUVertexAttribute[] = [{
      format,
      offset: 0,
      shaderLocation: location,
    }];
    return pipelineResourceFactory.ofVertexBufferDetail(arrayStride, attributes, location, step, meshBufferResource.vertices);
  },
  ofBindingVertexBufferDetail: <TBufferFormats extends WPKEntityBufferFormats<any>>(
    bindingBufferLocation: WPKUserDefinedBufferLocation<TBufferFormats>,
    bufferFormats: TBufferFormats,
    buffersResources: Record<WPKBufferFormatKey<TBufferFormats>, WPKResource<WPKTrackedBuffer>>,
  ): WPKResource<WPKVertexBufferDetail> => {
    const { buffer, location, step } = bindingBufferLocation;
    const bufferFormat = bufferFormats[buffer];
    const bufferResource = buffersResources[buffer];
    const { contentType } = bufferFormat;
    const arrayStride = (contentType === 'layout')
      ? strideFuncs.ofLayout(bufferFormat.layout)
      : strideFuncs.ofMarshalledFormat(bufferFormat.marshall);
    const attributes = (contentType === 'layout')
      ? vertexAttributesFactory.of(location, bufferFormat.layout, vertexFormatsFactory.ofElementLayout, strideFuncs.ofElementLayout)
      : vertexAttributesFactory.of(location, bufferFormat.marshall, vertexFormatsFactory.ofFormatElement, strideFuncs.ofMarshalledFormatElement);
    return pipelineResourceFactory.ofVertexBufferDetail(arrayStride, attributes, location, step, bufferResource);
  },
  ofVertexBufferDetail: (
    arrayStride: number,
    attributes: GPUVertexAttribute[],
    location: number,
    step: GPUVertexStepMode,
    bufferResource: WPKResource<WPKTrackedBuffer>
  ): WPKResource<WPKVertexBufferDetail> => {
    return resourceFactory.ofCachedFromDependencies(
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
    vertexBufferDetailResources: WPKResource<WPKVertexBufferDetail>[]
  ): WPKResource<GPUBuffer[]> => {
    return resourceFactory.ofCachedFromDependencies(
      vertexBufferDetailResources,
      (device, queue, encoder, values) => values.map((data) => data.buffer)
    );
  },
  ofVertexBufferLayouts: (
    vertexBufferDetailsResource: WPKResource<WPKVertexBufferDetail[]>
  ): WPKResource<GPUVertexBufferLayout[]> => {
    return resourceFactory.ofCachedFromDependencies(
      [vertexBufferDetailsResource] as const,
      (_device, _queue, _encoder, values) => values[0].map((data) => data.layout)
    );
  },
  ofRenderPipeline: (
    name: string,
    index: number,
    mesh: WPKMesh,
    shaderModuleResource: WPKResource<GPUShaderModule>,
    vertexShaderEntryPoint: string,
    fragmentShaderEntryPoint: string,
    vertexBufferLayoutsResource: WPKResource<GPUVertexBufferLayout[]>,
    renderPipelineLayoutResource: WPKResource<GPUPipelineLayout>,
    isAntiAliasedFunc: () => boolean,
    textureFormatFunc: () => GPUTextureFormat,
  ): WPKResource<GPURenderPipeline> => {
    const label = `${name}-render-pipeline-${index}`;
    const topology = mesh.topology;
    const frontFace = mesh.winding;
    const cullMode = meshFuncs.cullMode(mesh);
    const isAntiAliasedResource: WPKResource<boolean> = {
      get: (_device, _queue, _encoder) => isAntiAliasedFunc(),
    };
    const textureFormatResource: WPKResource<GPUTextureFormat> = {
      get: (_device, _queue, _encoder) => textureFormatFunc(),
    };
    return resourceFactory.ofCachedFromDependencies(
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
          count: pipelineFuncs.toSampleCount(values[3]),
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
    bindGroupsDetailResource: WPKResource<WPKBindGroupsDetail>,
    indicesBufferResource: WPKResource<GPUBuffer>,
    vertexBuffersResource: WPKResource<GPUBuffer[]>,
    renderPipelineResource: WPKResource<GPURenderPipeline>,
    drawCountsFunc: () => WPKDrawCounts,
  ): WPKResource<WPKRenderPipelineDetail> => {
    return resourceFactory.ofCachedFromDependencies(
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
