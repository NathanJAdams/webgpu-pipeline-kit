import { getLogger } from './logging';
import { meshFuncs } from './mesh-factories';
import { pipelineFuncs } from './pipeline-utils';
import { resourceFactory } from './resources';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKBindingIndex, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferResources, WPKComputePass, WPKComputePipelineDetail, WPKDispatchParamsDetail, WPKDispatchCount, WPKDrawCounts, WPKGroupIndex, WPKMesh, WPKMeshBufferResource, WPKRenderPipelineDetail, WPKResource, WPKShaderModuleDetail, WPKTrackedBuffer, WPKVertexBufferAttributeData, WPKVertexBufferDetail } from './types';
import { logFuncs } from './utils';

const LOGGER = getLogger('resources');

export const pipelineResourceFactory = {
  // layouts
  ofBindGroupLayout: (
    name: string,
    entries: GPUBindGroupLayoutEntry[]
  ): WPKResource<GPUBindGroupLayout> => {
    const label = `${name}-bind-group-layout`;
    logFuncs.lazyDebug(LOGGER, () => `Creating bind group layout resource ${label}`);
    let layout: GPUBindGroupLayout | undefined;
    return resourceFactory.ofCached({
      update(device, _queue, _encoder) {
        logFuncs.lazyTrace(LOGGER, () => `Creating bind group layout ${label}`);
        layout = device.createBindGroupLayout({
          label,
          entries,
        });
        logFuncs.lazyTrace(LOGGER, () => `Created bind group layout ${JSON.stringify(layout)}`);
        return layout;
      },
      get() {
        return resourceFactory.getOrThrow(layout, `bind group layout ${label}`);
      },
      clean() {
      },
    });
  },
  ofPipelineLayout: (
    name: string,
    bindGroupLayoutsResource: WPKResource<GPUBindGroupLayout[]>
  ): WPKResource<GPUPipelineLayout> => {
    const label = `${name}-pipeline-layout`;
    logFuncs.lazyDebug(LOGGER, () => `Creating pipeline layout resource ${label}`);
    let layout: GPUPipelineLayout | undefined;
    return resourceFactory.ofCached({
      update(device, queue, encoder) {
        const bindGroupLayouts = bindGroupLayoutsResource.update(device, queue, encoder);
        logFuncs.lazyTrace(LOGGER, () => `Creating pipeline layout ${label} from ${bindGroupLayouts.length} bind group layouts [${bindGroupLayouts.map(l => l.label).join(', ')}]`);
        layout = device.createPipelineLayout({
          label,
          bindGroupLayouts,
        });
        logFuncs.lazyTrace(LOGGER, () => `Created pipeline layout ${JSON.stringify(layout)}`);
        return layout;
      },
      get() {
        return resourceFactory.getOrThrow(layout, `pipeline layout ${label}`);
      },
      clean() {
        bindGroupLayoutsResource.clean();
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
        const module = device.createShaderModule({
          label,
          code,
          compilationHints: entryPoints.map((entryPoint) => ({
            entryPoint,
            layout: values[0],
          })),
        });
        logFuncs.lazyTrace(LOGGER, () => `Created shader module ${JSON.stringify(module)}`);
        return module;
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
        const entry = {
          binding,
          resource: {
            buffer: values[0].buffer,
          },
        };
        logFuncs.lazyTrace(LOGGER, () => `Created bind group entry ${JSON.stringify({ ...entry, buffer: entry.resource.buffer.label, })}`);
        return entry;
      },
    );
  },
  ofBindGroup: (
    name: string,
    bindGroupLayoutResource: WPKResource<GPUBindGroupLayout>,
    bindGroupEntriesResource: WPKResource<GPUBindGroupEntry[]>
  ): WPKResource<GPUBindGroup> => {
    const label = `${name}-bind-group`;
    logFuncs.lazyDebug(LOGGER, () => `Creating bind group resource ${label}`);
    return resourceFactory.ofCachedFromDependencies(
      [bindGroupLayoutResource, bindGroupEntriesResource] as const,
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => `Creating bind group ${label}`);
        const group = device.createBindGroup({
          label,
          layout: values[0],
          entries: values[1],
        });
        logFuncs.lazyTrace(LOGGER, () => `Created bind group ${JSON.stringify(group)}`);
        return group;
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
        const detail = {
          group: values[0],
          index: group,
        };
        logFuncs.lazyTrace(LOGGER, () => `Created bind group detail ${JSON.stringify(detail)}`);
        return detail;
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
        const pipeline = device.createComputePipeline({
          label,
          layout: values[0],
          compute: {
            module: values[1],
            entryPoint,
          },
        });
        logFuncs.lazyTrace(LOGGER, () => `Created compute pipeline ${JSON.stringify(pipeline)}`);
        return pipeline;
      },
    );
  },
  ofComputeDetail: (
    bindGroupsResource: WPKResource<WPKBindGroupsDetail>,
    computePipelineResource: WPKResource<GPUComputePipeline>,
    dispatchCountResource: WPKResource<WPKDispatchCount>,
  ): WPKResource<WPKComputePipelineDetail> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating compute detail resource');
    return resourceFactory.ofCachedFromDependencies(
      [bindGroupsResource, computePipelineResource, dispatchCountResource] as const,
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => 'Creating compute detail');
        const detail = {
          bindGroups: values[0],
          pipeline: values[1],
          dispatchCount: values[2],
        };
        logFuncs.lazyTrace(LOGGER, () => `Created compute detail ${JSON.stringify(detail)}`);
        return detail;
      },
    );
  },
  ofDispatchParams: (
    instanceCountResource: WPKResource<number>,
    passes: WPKComputePass<any, any, any>[],
  ): WPKResource<WPKDispatchParamsDetail<any>> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating dispatch params resource');
    return resourceFactory.ofCachedFromDependencies(
      [instanceCountResource] as const,
      (_device, _queue, _encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => 'Creating dispatch params resource');
        const params = pipelineFuncs.toDispatchParams(passes, values[0]);
        logFuncs.lazyTrace(LOGGER, () => `Created dispatch params ${JSON.stringify(params)}`);
        return params;
      }
    );
  },
  ofDispatchCount: (
    dispatchParamsResource: WPKResource<WPKDispatchParamsDetail<any>>,
    entryPoint: string,
  ): WPKResource<WPKDispatchCount> => {
    logFuncs.lazyDebug(LOGGER, () => 'Creating dispatch size resource');
    return resourceFactory.ofCachedFromDependencies(
      [dispatchParamsResource] as const,
      (_device, _queue, _encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => `Creating dispatch size for ${entryPoint}`);
        const count = values[0].dispatchCounts[entryPoint];
        logFuncs.lazyTrace(LOGGER, () => `Created dispatch size ${JSON.stringify(count)}`);
        return count;
      }
    );
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
    const detail = pipelineResourceFactory.ofVertexBufferDetail(arrayStride, attributes, 'vertex', meshBufferResource.vertices);
    logFuncs.lazyTrace(LOGGER, () => `Created vertex buffer detail resource ${JSON.stringify(detail)}`);
    return detail;
  },
  ofVertexBufferDetailBufferLocationFieldTypes: <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
    vertexBufferLocationFieldTypes: WPKVertexBufferAttributeData<TUniform, TEntity, TBufferFormatMap>,
    bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>
  ): WPKResource<WPKVertexBufferDetail> => {
    logFuncs.lazyDebug(LOGGER, () => `Creating vertex buffer detail resource from buffer location field types ${JSON.stringify(vertexBufferLocationFieldTypes)}`);
    const { buffer, locationAttributes, stride } = vertexBufferLocationFieldTypes;
    const bufferResource = bufferResources.buffers[buffer as WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>];
    const attributes = locationAttributes.map(attribute => attribute.attribute);
    const detail = pipelineResourceFactory.ofVertexBufferDetail(stride, attributes, 'instance', bufferResource);
    logFuncs.lazyTrace(LOGGER, () => `Created vertex buffer detail resource ${JSON.stringify(detail)}`);
    return detail;
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
        const detail = {
          buffer: values[0].buffer,
          layout: {
            arrayStride,
            attributes,
            stepMode: step,
          },
        };
        logFuncs.lazyTrace(LOGGER, () => `Created vertex buffer detail ${JSON.stringify({ ...detail, buffer: detail.buffer.label, })}`);
        return detail;
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
        const buffers = values.map((data) => data.buffer);
        logFuncs.lazyTrace(LOGGER, () => `Created vertex buffers ${JSON.stringify(buffers.map(b => b.label))}`);
        return buffers;
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
        const layouts = values[0].map((data) => data.layout);
        logFuncs.lazyTrace(LOGGER, () => `Created vertex buffer layouts ${JSON.stringify(layouts)}`);
        return layouts;
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
  ): WPKResource<GPURenderPipeline> => {
    const label = `${name}-render-pipeline-${index}`;
    logFuncs.lazyDebug(LOGGER, () => `Creating render pipeline resource ${label}`);
    const topology = mesh.topology;
    const frontFace = mesh.winding;
    const cullMode = meshFuncs.cullMode(mesh);
    const gpu = pipelineFuncs.getGpu();
    const format = pipelineFuncs.getFormat(gpu);
    return resourceFactory.ofCachedFromDependencies(
      [renderPipelineLayoutResource, shaderModuleResource, vertexBufferLayoutsResource] as const,
      (device, queue, encoder, values) => {
        logFuncs.lazyTrace(LOGGER, () => `Creating render pipeline ${label}`);
        const pipeline = device.createRenderPipeline({
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
              format,
            }],
          },
          multisample: {
            count: pipelineFuncs.ANTI_ALIASED_SAMPLE_COUNT,
          },
          primitive: {
            topology,
            frontFace,
            cullMode,
          },
        });
        logFuncs.lazyTrace(LOGGER, () => `Created render pipeline ${pipeline}`);
        return pipeline;
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
        const detail = {
          bindGroups: values[0],
          indices: {
            buffer: values[1],
            format: indicesType,
          },
          vertexBuffers: values[2],
          pipeline: values[3],
          drawCountsFunc,
        };
        logFuncs.lazyTrace(LOGGER, () => `Created render pipeline detail ${JSON.stringify({ ...detail, vertexBuffers: detail.vertexBuffers.map(b => b.label), })}`);
        return detail;
      }
    );
  },
};
