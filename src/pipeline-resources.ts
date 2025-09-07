import { bufferResourcesFactory } from './buffer-resources';
import { logFactory } from './logging';
import { meshFuncs } from './mesh-factories';
import { pipelineFuncs } from './pipeline-utils';
import { resourceFactory } from './resources';
import { DISPATCH_MARSHALLER } from './shader-reserved';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKBindingIndex, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferResources, WPKComputePipelineDetail, WPKDispatchParams, WPKDispatchSize, WPKDrawCounts, WPKGroupIndex, WPKMesh, WPKMeshBufferResource, WPKRenderPipelineDetail, WPKResource, WPKShaderModuleDetail, WPKTrackedBuffer, WPKVertexBufferDetail, WPKVertexBufferAttributeData } from './types';
import { logFuncs } from './utils';

const LOGGER = logFactory.getLogger('pipeline');

export const pipelineResourceFactory = {
  // layouts
  ofBindGroupLayout: (
    name: string,
    entries: GPUBindGroupLayoutEntry[]
  ): WPKResource<GPUBindGroupLayout> => {
    const label = `${name}-bind-group-layout`;
    logFuncs.lazyDebug(LOGGER, () => `Creating bind group layout resource ${label}`);
    return resourceFactory.ofCached({
      get(device, _queue, _encoder) {
        logFuncs.lazyTrace(LOGGER, () => `Creating bind group layout ${label}`);
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
    logFuncs.lazyDebug(LOGGER, () => `Creating pipeline layout resource ${label}`);
    return resourceFactory.ofCached({
      get(device, queue, encoder) {
        const bindGroupLayouts = bindGroupLayoutsResource.get(device, queue, encoder);
        logFuncs.lazyTrace(LOGGER, () => `Creating pipeline layout ${label}`);
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
    logFuncs.lazyDebug(LOGGER, () => `Creating shader module resource ${label}`);
    const { code, entryPoints } = shaderModule;
    return resourceFactory.ofCachedFromDependencies(
      [pipelineLayoutResource],
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => `Creating shader module ${label}`);
        return device.createShaderModule({
          label,
          code,
          compilationHints: entryPoints.map((entryPoint) => ({
            entryPoint,
            layout: values[0],
          })),
        });
      },
    );
  },

  // bind groups
  ofBindGroupEntry: (
    binding: WPKBindingIndex,
    bufferResource: WPKResource<WPKTrackedBuffer>
  ): WPKResource<GPUBindGroupEntry> => {
    logFuncs.lazyDebug(LOGGER, () => `Creating bind group entry resource binding ${binding}`);
    return resourceFactory.ofCachedFromDependencies(
      [bufferResource] as const,
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => `Creating bind group entry binding ${binding}`);
        return {
          binding,
          resource: {
            buffer: values[0].buffer,
          },
        };
      },
    );
  },
  ofBindGroup: (
    name: string,
    group: WPKGroupIndex,
    bindGroupLayoutResource: WPKResource<GPUBindGroupLayout>,
    bindGroupEntriesResource: WPKResource<GPUBindGroupEntry[]>
  ): WPKResource<GPUBindGroup> => {
    const label = `${name}-bind-group-${group}`;
    logFuncs.lazyDebug(LOGGER, () => `Creating bind group resource ${label}`);
    return resourceFactory.ofCachedFromDependencies(
      [bindGroupLayoutResource, bindGroupEntriesResource] as const,
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => `Creating bind group ${label}`);
        return device.createBindGroup({
          label,
          layout: values[0],
          entries: values[1],
        });
      },
    );
  },
  ofBindGroupDetail: (
    group: WPKGroupIndex,
    bindGroupResource: WPKResource<GPUBindGroup>,
  ): WPKResource<WPKBindGroupDetail> => {
    logFuncs.lazyDebug(LOGGER, () => `Creating bind group detail group index ${group}`);
    return resourceFactory.ofCachedFromDependencies(
      [bindGroupResource],
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => `Creating bind group detail group index ${group}`);
        return {
          group: values[0],
          index: group,
        };
      },
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
    logFuncs.lazyDebug(LOGGER, () => `Creating compute pipeline resource ${label}`);
    return resourceFactory.ofCachedFromDependencies(
      [pipelineLayoutResource, shaderResource] as const,
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => `Creating compute pipeline ${label}`);
        return device.createComputePipeline({
          label,
          layout: values[0],
          compute: {
            module: values[1],
            entryPoint,
          },
        });
      },
    );
  },
  ofComputeDetail: (
    bindGroupsResource: WPKResource<WPKBindGroupsDetail>,
    computePipelineResource: WPKResource<GPUComputePipeline>,
    dispatchSizeResource: WPKResource<WPKDispatchSize>,
  ): WPKResource<WPKComputePipelineDetail> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating compute detail resource');
    return resourceFactory.ofCachedFromDependencies(
      [bindGroupsResource, computePipelineResource, dispatchSizeResource] as const,
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => 'Creating compute detail');
        return {
          bindGroups: values[0],
          pipeline: values[1],
          dispatchSize: values[2],
        };
      },
    );
  },
  ofDispatchSize: (
    name: string,
    dispatchParamsFunc: () => WPKDispatchParams,
  ): WPKResource<WPKDispatchSize> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating dispatch buffer resource');
    const dispatchBufferResource = bufferResourcesFactory.ofDispatch(name);
    let previousInstanceCount = 0;
    return {
      get(device, queue, encoder) {
        const dispatchParams = dispatchParamsFunc();
        const { instanceCount } = dispatchParams;
        if (previousInstanceCount !== instanceCount) {
          previousInstanceCount = instanceCount;
          const data = DISPATCH_MARSHALLER.encode([dispatchParams]);
          dispatchBufferResource.mutate(data, 0);
          // pull data through to buffer
          dispatchBufferResource.get(device, queue, encoder);
        }
        return dispatchParams.dispatchSize;
      },
    };
  },

  // render
  ofVertexBufferDetailMesh: (
    meshBufferLocation: number,
    meshBufferResource: WPKMeshBufferResource
  ): WPKResource<WPKVertexBufferDetail> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating vertex buffer detail resource from mesh');
    const format: GPUVertexFormat = 'float32x3';
    const arrayStride = pipelineFuncs.toByteLength(format);
    const attributes: GPUVertexAttribute[] = [{
      format,
      offset: 0,
      shaderLocation: meshBufferLocation,
    }];
    return pipelineResourceFactory.ofVertexBufferDetail(arrayStride, attributes, 'vertex', meshBufferResource.vertices);
  },
  ofVertexBufferDetailBufferLocationFieldTypes: <
    TUniform,
    TEntity,
    TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
  >(
    vertexBufferLocationFieldTypes: WPKVertexBufferAttributeData<TUniform, TEntity, TBufferFormatMap>,
    bufferFormats: TBufferFormatMap,
    bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>
  ): WPKResource<WPKVertexBufferDetail> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating vertex buffer detail resource from buffer location');
    const { buffer, locationAttributes, stride } = vertexBufferLocationFieldTypes;
    const bufferFormat = bufferFormats[buffer];
    const bufferResource = bufferResources.buffers[buffer as WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>];
    const { bufferType } = bufferFormat;
    if (bufferType === 'uniform') {
      throw Error(`Cannot create buffer location for uniform buffer ${buffer}`);
    }
    const attributes = locationAttributes.map(attribute => attribute.attribute);
    return pipelineResourceFactory.ofVertexBufferDetail(stride, attributes, 'instance', bufferResource);
  },
  ofVertexBufferDetail: (
    arrayStride: number,
    attributes: GPUVertexAttribute[],
    step: GPUVertexStepMode,
    bufferResource: WPKResource<WPKTrackedBuffer>
  ): WPKResource<WPKVertexBufferDetail> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating vertex buffer detail resource');
    return resourceFactory.ofCachedFromDependencies(
      [bufferResource] as const,
      (_device, _queue, _encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => 'Creating vertex buffer detail');
        return {
          buffer: values[0].buffer,
          layout: {
            arrayStride,
            attributes,
            stepMode: step,
          },
        };
      },
    );
  },
  ofVertexBuffers: (
    vertexBufferDetailResources: WPKResource<WPKVertexBufferDetail>[]
  ): WPKResource<GPUBuffer[]> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating vertex buffers resource');
    return resourceFactory.ofCachedFromDependencies(
      vertexBufferDetailResources,
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => 'Creating vertex buffers');
        return values.map((data) => data.buffer);
      },
    );
  },
  ofVertexBufferLayouts: (
    vertexBufferDetailsResource: WPKResource<WPKVertexBufferDetail[]>
  ): WPKResource<GPUVertexBufferLayout[]> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating vertex buffer layouts resource');
    return resourceFactory.ofCachedFromDependencies(
      [vertexBufferDetailsResource] as const,
      (_device, _queue, _encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => 'Creating vertex buffer layouts');
        return values[0].map((data) => data.layout);
      },
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
    logFuncs.lazyDebug(LOGGER, () => `Creating render pipeline resource ${label}`);
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
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => `Creating render pipeline ${label}`);
        return device.createRenderPipeline({
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
        });
      },
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
    logFuncs.lazyDebug(LOGGER, () => 'Creating render pipeline detail resource');
    return resourceFactory.ofCachedFromDependencies(
      [bindGroupsDetailResource, indicesBufferResource, vertexBuffersResource, renderPipelineResource] as const,
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => 'Creating render pipeline detail');
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
