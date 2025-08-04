import { WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatMapEntity, WPKBufferType, WPKBufferTypes, WPKContentType } from './buffer-formats';
import { bufferResourcesFactory, WPKBufferResources } from './buffer-resources';
import { WPKEntityCache, WPKUniformCache } from './cache';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKComputePipelineDetail, WPKDrawCounts, WPKPipelineDetail, WPKRenderPipelineDetail, WPKShaderModuleDetail, WPKVertexBufferDetail } from './detail-types';
import { WPKInstanceFormat } from './instance';
import { meshFuncs } from './mesh';
import { pipelineResourceFactory } from './pipeline-resources';
import { pipelineFuncs } from './pipeline-utils';
import { resourceFactory, WPKResource } from './resources';
import { shaderFuncs, WPKBufferBinding, WPKComputeShader, WPKRenderShader, WPKShader } from './shaders';
import { arrayFuncs, changeDetectorFactory, Color, NonEmptyArray, recordFuncs } from './utils';
import { viewsFuncFactory } from './views';

export type WPKPipelineDefinition<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = {
  name: string;
  shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormatMap>;
  bufferFormats: TBufferFormatMap;
  uniformCache: WPKUniformCache<TUniformFormat, any>,
  entityCache: WPKEntityCache<TEntityFormat, any, any>,
};

export type WPKPipelineOptions = {
  clear: Color;
  isAntiAliased: boolean;
};

export type WPKPipelineRunner = {
  invoke: (options: WPKPipelineOptions) => Promise<void>;
};

export type WPKPipeline = {
  pipelineDetail: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder, options: WPKPipelineDetailOptions) => WPKPipelineDetail;
};

type WPKPipelineDetailOptions = {
  isAntiAliased: boolean;
  textureFormat: GPUTextureFormat;
};

export const pipelineRunnerFactory = {
  of: async (canvas: HTMLCanvasElement, ...definitions: NonEmptyArray<WPKPipelineDefinition<any, any, any>>): Promise<WPKPipelineRunner> => {
    const allBufferResources = toAllBufferResources(definitions);
    const pipelines = toPipelines(definitions, allBufferResources);
    const context = pipelineFuncs.getContext(canvas);
    const device = await pipelineFuncs.getDevice();
    const format = pipelineFuncs.getFormat();
    const alphaMode = 'opaque';
    context.configure({
      alphaMode,
      device,
      format,
    });
    const getViews = viewsFuncFactory.of(canvas, context, device, format);
    return {
      // async not strictly needed, but useful to prevent changing signature in case future changes need it
      async invoke(options) {
        for (const bufferResources of allBufferResources.values()) {
          bufferResources.update();
        }
        const encoder = device.createCommandEncoder({
          label: 'command-encoder',
        });
        const { queue } = device;
        const detailOptions: WPKPipelineDetailOptions = {
          isAntiAliased: options.isAntiAliased,
          textureFormat: format,
        };
        const { clear, isAntiAliased } = options;
        const clearValue = [clear.r, clear.g, clear.b, clear.a || 1];
        const views = getViews(isAntiAliased);
        const pipelineDetails = pipelines.map((pipeline) => pipeline.pipelineDetail(device, queue, encoder, detailOptions));
        const validPipelines = pipelineDetails.filter((pipelineDetail) => pipelineDetail.isValid);
        for (const pipelineDetail of validPipelines) {
          const { compute } = pipelineDetail;
          if (compute !== undefined) {
            const computePass = encoder.beginComputePass();
            for (const computeEntry of compute) {
              const { bindGroups, pipeline, workGroupSizeFunc } = computeEntry;
              const workGroupSize = workGroupSizeFunc();
              computePass.setPipeline(pipeline);
              for (const bindGroup of bindGroups) {
                computePass.setBindGroup(bindGroup.index, bindGroup.group);
              }
              computePass.dispatchWorkgroups(workGroupSize.x, workGroupSize.y, workGroupSize.z);
            }
            computePass.end();
          }
          const { render } = pipelineDetail;
          if (render !== undefined) {
            const renderPass = encoder.beginRenderPass({
              label: 'render-encoder',
              colorAttachments: [{
                ...views,
                clearValue,
                loadOp: 'clear',
                storeOp: 'store'
              }]
            });
            for (const renderEntry of render) {
              const { bindGroups, pipeline, indices, vertexBuffers, drawCountsFunc } = renderEntry;
              const drawCounts = drawCountsFunc();
              renderPass.setPipeline(pipeline);
              for (const bindGroup of bindGroups) {
                renderPass.setBindGroup(bindGroup.index, bindGroup.group);
              }
              renderPass.setIndexBuffer(indices.buffer, indices.format);
              for (const [slot, vertexBuffer] of vertexBuffers.entries()) {
                renderPass.setVertexBuffer(slot, vertexBuffer);
              }
              renderPass.drawIndexed(drawCounts.indexCount, drawCounts.instanceCount);
            }
            renderPass.end();
          }
        }
        device.queue.submit([encoder.finish()]);
      },
    };
  },
};

const toAllBufferResources = (definitions: NonEmptyArray<WPKPipelineDefinition<any, any, any>>): Map<WPKBufferFormatMap<any, any>, WPKBufferResources<any, any, any>> => {
  const map = new Map<WPKBufferFormatMap<any, any>, WPKBufferResources<any, any, any>>();
  for (const definition of definitions) {
    const { name, uniformCache, entityCache, bufferFormats, shader } = definition;
    const bufferUsages = toBufferUsages(shader, bufferFormats);
    const bufferResources = bufferResourcesFactory.ofUniformAndInstances(name, uniformCache, entityCache, bufferFormats, bufferUsages);
    map.set(bufferFormats, bufferResources);
  }
  return map;
};

const toBufferUsages = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormatMap>,
  bufferFormats: TBufferFormatMap,
): Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap>, GPUBufferUsageFlags> => {
  return recordFuncs.mapRecord(bufferFormats, (bufferFormat, key) => {
    const isBinding = shader.compute?.bufferBindings.some(bb => bb.buffer === key) || shader.render?.bufferBindings.some(bb => bb.buffer === key);
    const isLocation = shader.render?.passes.some(p => p.vertex.bufferLocations.some(bl => bl.type === 'user-defined' && bl.buffer === key));
    const { bufferType } = bufferFormat;
    let usage = 0;
    if (bufferType === 'uniform') {
      if (isBinding) {
        usage |= GPUBufferUsage.UNIFORM;
      }
    } else {
      if (isBinding) {
        usage |= GPUBufferUsage.STORAGE;
      }
      if (isLocation) {
        usage |= GPUBufferUsage.VERTEX;
      }
    }
    if (usage === 0) {
      console.warn(`Buffer ${key} isn't used`);
    }
    return usage;
  }) as Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap>, GPUBufferUsageFlags>;
};

const toPipelines = (
  definitions: NonEmptyArray<WPKPipelineDefinition<any, any, any>>,
  allBufferResources: Map<WPKBufferFormatMap<any, any>, WPKBufferResources<any, any, any>>,
): NonEmptyArray<WPKPipeline> => {
  if (definitions.length === 0) {
    throw Error('Must have at least one pipeline definition');
  }
  return definitions.map(definition => toPipeline(definition, allBufferResources)) as NonEmptyArray<WPKPipeline>;
};

const toPipeline = (definition: WPKPipelineDefinition<any, any, any>, allBufferResources: Map<WPKBufferFormatMap<any, any>, WPKBufferResources<any, any, any>>): WPKPipeline => {
  const isAntiAliasedChangeDetector = changeDetectorFactory.ofTripleEquals<boolean>(true);
  const textureFormatChangeDetector = changeDetectorFactory.ofTripleEquals<GPUTextureFormat>('rgba8unorm');
  const pipelineDetailResource = toPipelineDetailResource(definition, isAntiAliasedChangeDetector.get, textureFormatChangeDetector.get, allBufferResources);
  return {
    pipelineDetail(device, queue, encoder, options) {
      const { isAntiAliased, textureFormat } = options;
      isAntiAliasedChangeDetector.compareAndUpdate(isAntiAliased);
      textureFormatChangeDetector.compareAndUpdate(textureFormat);
      return pipelineDetailResource.get(device, queue, encoder);
    },
  };
};

const toPipelineDetailResource = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  definition: WPKPipelineDefinition<TUniformFormat, TEntityFormat, TBufferFormatMap>,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
  allBufferResources: Map<WPKBufferFormatMap<any, any>, WPKBufferResources<any, any, any>>,
): WPKResource<WPKPipelineDetail> => {
  const { name, shader, bufferFormats } = definition;
  const bufferResources = allBufferResources.get(bufferFormats);
  if (bufferResources === undefined) {
    throw Error('Error when creating pipeline, no buffer resources');
  }
  const computePipelineDetailsResource = shaderFuncs.isComputeShader(shader)
    ? toComputePipelineDetailsResource(name, shader, () => bufferResources.instanceCount, bufferFormats, bufferResources, allBufferResources)
    : undefined;
  const renderPipelineDetailResource = shaderFuncs.isRenderShader(shader)
    ? toRenderPipelineDetailsResource(name, shader, () => bufferResources.instanceCount, bufferFormats, bufferResources, allBufferResources, isAntiAliasedFunc, textureFormatFunc)
    : undefined;
  return {
    get(device, queue, encoder) {
      bufferResources.update();
      const isValid = bufferResources.instanceCount > 0;
      const pipelineDetail: WPKPipelineDetail = {
        isValid,
      };
      if (isValid) {
        if (computePipelineDetailsResource !== undefined) {
          pipelineDetail.compute = computePipelineDetailsResource.get(device, queue, encoder);
        }
        if (renderPipelineDetailResource !== undefined) {
          pipelineDetail.render = renderPipelineDetailResource.get(device, queue, encoder);
        }
      }
      return pipelineDetail;
    },
  };
};

const toComputePipelineDetailsResource = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  name: string,
  computeShader: WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormatMap>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<any, any, any>,
  allBufferResources: Map<WPKBufferFormatMap<any, any>, WPKBufferResources<any, any, any>>,
): WPKResource<WPKComputePipelineDetail[]> | undefined => {
  const { compute: { bufferBindings, passes } } = computeShader;
  const visibility = GPUShaderStage.COMPUTE;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, bufferBindings, bufferFormats);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const computeShaderModuleDetail = toComputeShaderModuleDetail(computeShader);
  const computeShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, computeShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, bufferBindings, bufferFormats, bufferResources, allBufferResources);
  const computePipelineDetailResources: WPKResource<WPKComputePipelineDetail>[] = [];
  for (const [index, computePass] of passes.entries()) {
    const { entryPoint, workGroupSize } = computePass;
    const computePipelineResource = pipelineResourceFactory.ofComputePipeline(name, index, pipelineLayoutResource, computeShaderModuleResource, entryPoint);
    const workGroupSizeFunc = () => pipelineFuncs.toWorkGroupSize(workGroupSize, instanceCountFunc());
    const computeDetailResource = pipelineResourceFactory.ofComputeDetail(bindGroupsDetailResource, computePipelineResource, workGroupSizeFunc);
    computePipelineDetailResources.push(computeDetailResource);
  }
  return resourceFactory.ofArray(computePipelineDetailResources);
};

const toRenderPipelineDetailsResource = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  name: string,
  renderShader: WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<any, any, any>,
  allBufferResources: Map<WPKBufferFormatMap<any, any>, WPKBufferResources<any, any, any>>,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
): WPKResource<WPKRenderPipelineDetail[]> | undefined => {
  const { render: { bufferBindings, mesh, passes } } = renderShader;
  const visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, bufferBindings, bufferFormats);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const renderShaderModuleDetail = toRenderShaderModuleDetail(renderShader);
  const renderShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, renderShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, bufferBindings, bufferFormats, bufferResources, allBufferResources);
  const indicesCount = meshFuncs.indicesCount(mesh);
  const indicesType = meshFuncs.indicesType(mesh);
  const drawCountsFunc = (): WPKDrawCounts => ({
    indexCount: indicesCount,
    instanceCount: instanceCountFunc(),
  });
  const meshBufferResource = bufferResourcesFactory.ofMesh(name, mesh);
  const indicesBufferResource: WPKResource<GPUBuffer> = {
    get(device, queue, encoder) {
      return meshBufferResource.indices.get(device, queue, encoder).buffer;
    },
  };
  const instanceBufferFormats = recordFuncs.filter(bufferFormats, (bufferFormat) => bufferFormat.bufferType === 'entity') as WPKBufferFormatMapEntity<TEntityFormat>;
  const instanceEntityTrackedBufferResources = recordFuncs.filter(bufferResources.buffers, (_, key) => instanceBufferFormats[key as string] !== undefined);
  const renderPipelineDetailResources: WPKResource<WPKRenderPipelineDetail>[] = [];
  for (const [index, renderPass] of passes.entries()) {
    const { fragment, vertex } = renderPass;
    const meshBufferLocation = vertex.bufferLocations.find(bl => bl.type === 'mesh');
    const userDefinedVertexBufferDetailResources = vertex.bufferLocations
      .filter(bl => bl.type === 'user-defined')
      .map(bl => pipelineResourceFactory.ofVertexBufferDetailBufferLocation(bl, instanceBufferFormats, instanceEntityTrackedBufferResources));
    const vertexBufferDetailResources: WPKResource<WPKVertexBufferDetail>[] = [];
    if (meshBufferLocation !== undefined) {
      vertexBufferDetailResources.push(pipelineResourceFactory.ofVertexBufferDetailMesh(meshBufferLocation, meshBufferResource));
    }
    vertexBufferDetailResources.push(...userDefinedVertexBufferDetailResources);
    const vertexBufferDetailsResource = resourceFactory.ofArray(vertexBufferDetailResources);
    const vertexBufferLayoutsResource = pipelineResourceFactory.ofVertexBufferLayouts(vertexBufferDetailsResource);
    const vertexBuffersResource = pipelineResourceFactory.ofVertexBuffers(vertexBufferDetailResources);
    const pipelineResource = pipelineResourceFactory.ofRenderPipeline(name, index, mesh, renderShaderModuleResource, vertex.entryPoint, fragment.entryPoint, vertexBufferLayoutsResource, pipelineLayoutResource, isAntiAliasedFunc, textureFormatFunc);
    const renderPipelineDetailResource = pipelineResourceFactory.ofRenderPipelineDetail(indicesType, bindGroupsDetailResource, indicesBufferResource, vertexBuffersResource, pipelineResource, drawCountsFunc);
    renderPipelineDetailResources.push(renderPipelineDetailResource);
  }
  return resourceFactory.ofArray(renderPipelineDetailResources);
};

const toComputeShaderModuleDetail = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  computeShader: WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormatMap>,
): WPKShaderModuleDetail => {
  const { compute: { passes, shader } } = computeShader;
  return {
    code: shader,
    entryPoints: passes.map(c => c.entryPoint),
  };
};

const toRenderShaderModuleDetail = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  renderShader: WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap>,
): WPKShaderModuleDetail => {
  const { render: { passes, shader } } = renderShader;
  return {
    code: shader,
    entryPoints: arrayFuncs.merge(passes.map(r => r.vertex.entryPoint), passes.map(r => r.fragment.entryPoint)),
  };
};

const toBindGroupLayoutEntries = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  visibility: GPUShaderStageFlags,
  bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormatMap>[],
  bufferFormats: TBufferFormatMap,
  group: number,
): GPUBindGroupLayoutEntry[] => {
  return bufferBindings
    .filter((bufferBinding) => bufferBinding.group === group)
    .map((bufferBinding) => {
      const { binding, buffer } = bufferBinding;
      const bufferFormat = (typeof buffer === 'string')
        ? bufferFormats[buffer]
        : buffer.formats[buffer.key];
      const type = toBufferBindingType(visibility, bufferFormat);
      return {
        binding,
        visibility,
        buffer: {
          type
        },
      };
    });
};

const toBufferBindingType = <TBufferType extends WPKBufferType, TContentType extends WPKContentType>(visibility: GPUShaderStageFlags, bufferFormat: WPKBufferTypes<TBufferType, TContentType>): GPUBufferBindingType => {
  return bufferFormat.bufferType === 'uniform'
    ? 'uniform'
    : (visibility === GPUShaderStage.COMPUTE) && (bufferFormat.contentType === 'layout')
      ? 'storage'
      : 'read-only-storage';
};

const toBindGroupLayoutsResource = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  name: string,
  visibility: GPUShaderStageFlags,
  bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormatMap>[],
  bufferFormats: TBufferFormatMap
): WPKResource<GPUBindGroupLayout[]> => {
  const maxBindGroup = toMaxBindGroup(bufferBindings);
  const bindGroupLayoutResources: WPKResource<GPUBindGroupLayout>[] = [];
  for (let group = 0; group <= maxBindGroup; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(visibility, bufferBindings, bufferFormats, group);
    const bindGroupLayoutResource = pipelineResourceFactory.ofBindGroupLayout(groupName, bindGroupLayoutEntries);
    bindGroupLayoutResources.push(bindGroupLayoutResource);
  }
  return resourceFactory.ofArray(bindGroupLayoutResources);
};

const toBindGroupsDetailResource = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  name: string,
  visibility: GPUShaderStageFlags,
  bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormatMap>[],
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<any, any, any>,
  allBufferResources: Map<WPKBufferFormatMap<any, any>, WPKBufferResources<any, any, any>>,
): WPKResource<WPKBindGroupsDetail> => {
  const maxBindGroup = toMaxBindGroup(bufferBindings);
  const bindGroupDetailResources: WPKResource<WPKBindGroupDetail>[] = [];
  for (let group = 0; group <= maxBindGroup; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(visibility, bufferBindings, bufferFormats, group);
    const bindGroupLayoutResource = pipelineResourceFactory.ofBindGroupLayout(groupName, bindGroupLayoutEntries);
    const bindGroupEntriesResources = toBindGroupEntriesResources(bufferBindings, bufferResources, allBufferResources, group);
    const bindGroupEntriesResource = resourceFactory.ofArray(bindGroupEntriesResources);
    const bindGroupResource = pipelineResourceFactory.ofBindGroup(groupName, group, bindGroupLayoutResource, bindGroupEntriesResource);
    const bindGroupDetailResource = pipelineResourceFactory.ofBindGroupDetail(group, bindGroupResource);
    bindGroupDetailResources.push(bindGroupDetailResource);
  }
  return resourceFactory.ofArray(bindGroupDetailResources);
};

const toBindGroupEntriesResources = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormatMap>[],
  bufferResources: WPKBufferResources<any, any, any>,
  allBufferResources: Map<WPKBufferFormatMap<any, any>, WPKBufferResources<any, any, any>>,
  group: number
): WPKResource<GPUBindGroupEntry>[] => {
  return bufferBindings
    .filter((bufferBinding) => bufferBinding.group === group)
    .map((bufferBinding) => {
      const { binding, buffer } = bufferBinding;
      const bufferResource = shaderFuncs.isBufferBindingRefNative(buffer)
        ? bufferResources.buffers[buffer]
        : allBufferResources.get(buffer.formats)?.buffers[buffer.key];
      if (bufferResource === undefined) {
        throw Error(`Cannot create bind group entries for group ${group} and buffer ${JSON.stringify(bufferBinding.buffer)} without a buffer`);
      }
      return pipelineResourceFactory.ofBindGroupEntry(binding, bufferResource);
    });
};

const toMaxBindGroup = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormatMap>[]): number => {
  return bufferBindings.reduce((max, bufferBinding) => Math.max(max, bufferBinding.group), -1);
};
