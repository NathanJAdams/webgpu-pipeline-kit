import { usageToString } from './buffer-factory';
import { WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatMapEntity, WPKBufferType, WPKBufferTypes, WPKContentType } from './buffer-formats';
import { bufferResourcesFactory, WPKBufferResources } from './buffer-resources';
import { WPKEntityCache, WPKUniformCache } from './cache';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKComputePipelineDetail, WPKDrawCounts, WPKPipelineDetail, WPKRenderPipelineDetail, WPKShaderModuleDetail, WPKVertexBufferDetail } from './detail-types';
import { WPKInstanceFormat } from './instance';
import { getLogger, lazyDebug, lazyInfo, lazyTrace, lazyWarn } from './logging';
import { WPKMeshFactoryMap } from './mesh-factory';
import { meshFuncs } from './meshes';
import { pipelineResourceFactory } from './pipeline-resources';
import { pipelineFuncs } from './pipeline-utils';
import { resourceFactory, WPKResource } from './resources';
import { shaderFuncs, WPKBufferBinding, WPKComputeShader, WPKRenderShader, WPKShader } from './shaders';
import { arrayFuncs, changeDetectorFactory, Color, recordFuncs } from './utils';
import { viewsFuncFactory } from './views';

export type WPKPipelineDefinition<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap> = {
  meshFactories: TMeshFactoryMap;
  shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>;
  bufferFormats: TBufferFormatMap;
  uniformCache: WPKUniformCache<TUniformFormat, any>,
  entityCache: WPKEntityCache<TEntityFormat, any, any>,
};

export type WPKPipelineOptionsAddBefore = {
  before: string;
};
export type WPKPipelineOptionsAddAfter = {
  after: string;
};
export type WPKAddPipelineOptions =
  | WPKPipelineOptionsAddBefore
  | WPKPipelineOptionsAddAfter;

export type WPKPipelineOptions = {
  clear: Color;
  isAntiAliased: boolean;
};

export type WPKPipelineRunner = {
  add: (name: string, definition: WPKPipelineDefinition<any, any, any, any>, options?: WPKAddPipelineOptions) => void;
  remove: (name: string) => void;
  invoke: (options: WPKPipelineOptions) => Promise<void>;
};

export type WPKPipeline = {
  pipelineDetail: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder, options: WPKPipelineDetailOptions) => WPKPipelineDetail;
};

type WPKPipelineDetailOptions = {
  isAntiAliased: boolean;
  textureFormat: GPUTextureFormat;
};

type WPKNamedPipeline = [string, WPKPipeline];
const LOGGER = getLogger('pipeline');

const isOptionsAddBefore = (options?: WPKAddPipelineOptions): options is WPKPipelineOptionsAddBefore => (options !== undefined && (options as WPKPipelineOptionsAddBefore).before !== undefined);
const isOptionsAddAfter = (options?: WPKAddPipelineOptions): options is WPKPipelineOptionsAddAfter => (options !== undefined && (options as WPKPipelineOptionsAddAfter).after !== undefined);

export const pipelineRunnerFactory = {
  of: async (canvas: HTMLCanvasElement): Promise<WPKPipelineRunner> => {
    lazyInfo(LOGGER, () => 'Creating pipeline runner');
    const namedPipelines: WPKNamedPipeline[] = [];
    const context = pipelineFuncs.getContext(canvas);
    const gpu = pipelineFuncs.getGpu();
    const device = await pipelineFuncs.getDevice(gpu);
    const format = pipelineFuncs.getFormat(gpu);
    const alphaMode = 'opaque';
    context.configure({
      alphaMode,
      device,
      format,
    });
    const getViews = viewsFuncFactory.of(canvas, context, device, format);
    return {
      add(name, definition, options) {
        if (namedPipelines.findIndex(([pipelineName]) => name === pipelineName) !== -1) {
          throw Error(`Cannot add a pipeline with duplicate name '${name}'`);
        }
        const pipeline = toPipeline(name, definition);
        const insertIndex = toInsertIndex(namedPipelines, options);
        lazyInfo(LOGGER, () => `Adding pipeline '${name}'`);
        namedPipelines.splice(insertIndex, 0, [name, pipeline]);
      },
      remove(name) {
        const removeIndex = toInsertIndexFromName(namedPipelines, name, false);
        if (removeIndex === -1) {
          lazyWarn(LOGGER, () => `No pipeline to remove with name '${name}'`);
        } else {
          lazyInfo(LOGGER, () => `Removing pipeline '${name}'`);
          namedPipelines.splice(removeIndex, 1);
        }
      },
      // async not strictly needed, but useful to prevent changing signature in case future changes need it
      async invoke(options) {
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
        lazyTrace(LOGGER, () => `Creating pipeline details from ${namedPipelines.length} pipelines`);
        const pipelineDetails = namedPipelines.map(([, pipeline]) => pipeline.pipelineDetail(device, queue, encoder, detailOptions));
        const invalidPipelineNames = pipelineDetails
          .filter((pipelineDetail) => pipelineDetail.instanceCount === 0)
          .map(pipelineDetail => pipelineDetail.name);
        if (invalidPipelineNames.length > 0) {
          lazyInfo(LOGGER, () => `No entities for pipelines [${invalidPipelineNames.join(', ')}]`);
        }
        const validPipelines = pipelineDetails.filter((pipelineDetail) => pipelineDetail.instanceCount > 0);
        lazyDebug(LOGGER, () => `Invoking ${validPipelines.length} valid pipelines`);
        for (const [pipelineIndex, pipelineDetail] of validPipelines.entries()) {
          lazyTrace(LOGGER, () => `Invoking pipeline ${JSON.stringify(pipelineDetail)}`);
          const { compute } = pipelineDetail;
          if (compute !== undefined) {
            lazyTrace(LOGGER, () => `Compute shader of pipeline[${pipelineIndex}]`);
            const computePass = encoder.beginComputePass();
            for (const [computeEntryIndex, computeEntry] of compute.entries()) {
              lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}]`);
              const { bindGroups, pipeline, workGroupSizeFunc } = computeEntry;
              const workGroupSize = workGroupSizeFunc();
              computePass.setPipeline(pipeline);
              for (const bindGroup of bindGroups) {
                lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}] set bind group ${JSON.stringify(bindGroup)}`);
                computePass.setBindGroup(bindGroup.index, bindGroup.group);
              }
              lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}] dispatch work group ${JSON.stringify(workGroupSize)}`);
              computePass.dispatchWorkgroups(workGroupSize.x, workGroupSize.y, workGroupSize.z);
            }
            computePass.end();
          }
          const { render } = pipelineDetail;
          if (render !== undefined) {
            lazyTrace(LOGGER, () => `Render shader of pipeline[${pipelineIndex}]`);
            const renderPass = encoder.beginRenderPass({
              label: 'render-encoder',
              colorAttachments: [{
                ...views,
                clearValue,
                loadOp: 'clear',
                storeOp: 'store'
              }]
            });
            for (const [renderEntryIndex, renderEntry] of render.entries()) {
              lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}]`);
              const { bindGroups, pipeline, indices, vertexBuffers, drawCountsFunc } = renderEntry;
              const drawCounts = drawCountsFunc();
              renderPass.setPipeline(pipeline);
              for (const bindGroup of bindGroups) {
                lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] set bind group ${JSON.stringify(bindGroup)}`);
                renderPass.setBindGroup(bindGroup.index, bindGroup.group);
              }
              lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] set indices buffer`);
              renderPass.setIndexBuffer(indices.buffer, indices.format);
              for (const [slot, vertexBuffer] of vertexBuffers.entries()) {
                lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] set vertex buffer in slot ${slot}`);
                renderPass.setVertexBuffer(slot, vertexBuffer);
              }
              lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] draw indexed ${JSON.stringify(drawCounts)}`);
              renderPass.drawIndexed(drawCounts.indexCount, drawCounts.instanceCount);
            }
            renderPass.end();
          }
        }
        lazyTrace(LOGGER, () => `Submit encoder for ${validPipelines.length} pipelines`);
        device.queue.submit([encoder.finish()]);
      },
    };
  },
};

const toInsertIndex = (pipelines: WPKNamedPipeline[], options?: WPKAddPipelineOptions): number => {
  if (isOptionsAddBefore(options)) {
    return toInsertIndexFromName(pipelines, options.before, false);
  } else if (isOptionsAddAfter(options)) {
    return toInsertIndexFromName(pipelines, options.after, true);
  } else {
    return pipelines.length;
  }
};

const toInsertIndexFromName = (pipelines: WPKNamedPipeline[], name: string, incrementFoundIndex: boolean): number => {
  const index = toIndexFromName(pipelines, name);
  return (index === -1)
    ? pipelines.length
    : index + (incrementFoundIndex ? 1 : 0);
};

const toIndexFromName = (pipelines: WPKNamedPipeline[], name: string): number => pipelines.findIndex(([pipelineName]) => pipelineName === name);

const toPipeline = (name: string, definition: WPKPipelineDefinition<any, any, any, any>): WPKPipeline => {
  const isAntiAliasedChangeDetector = changeDetectorFactory.ofTripleEquals<boolean>(true);
  const textureFormatChangeDetector = changeDetectorFactory.ofTripleEquals<GPUTextureFormat>('rgba8unorm');
  const bufferResources = toBufferResources(name, definition);
  const pipelineDetailResource = toPipelineDetailResource(name, definition, isAntiAliasedChangeDetector.get, textureFormatChangeDetector.get, bufferResources);
  return {
    pipelineDetail(device, queue, encoder, options) {
      bufferResources.update();
      const { isAntiAliased, textureFormat } = options;
      isAntiAliasedChangeDetector.compareAndUpdate(isAntiAliased);
      textureFormatChangeDetector.compareAndUpdate(textureFormat);
      return pipelineDetailResource.get(device, queue, encoder);
    },
  };
};

const toBufferResources = (name: string, definition: WPKPipelineDefinition<any, any, any, any>): WPKBufferResources<any, any, any> => {
  lazyTrace(LOGGER, () => `Create buffer resources for definition ${name}`);
  const { uniformCache, entityCache, bufferFormats, shader } = definition;
  const bufferUsages = toBufferUsages(shader, bufferFormats);
  return bufferResourcesFactory.ofUniformAndInstances(name, uniformCache, entityCache, bufferFormats, bufferUsages);
};

const toBufferUsages = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormatMap, any>,
  bufferFormats: TBufferFormatMap,
): Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap>, GPUBufferUsageFlags> => {
  lazyDebug(LOGGER, () => `Calculate buffer usage from buffer formats ${JSON.stringify(Object.keys(bufferFormats))}`);
  return recordFuncs.mapRecord(bufferFormats, (bufferFormat, key) => {
    lazyTrace(LOGGER, () => `Calculate buffer usage from buffer format ${JSON.stringify(key)}`);
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
    lazyTrace(LOGGER, () => `Buffer ${key} has usage ${usageToString(usage)}`);
    if (usage === 0) {
      lazyWarn(LOGGER, () => `Buffer ${key} isn't used`);
    }
    return usage;
  }) as Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap>, GPUBufferUsageFlags>;
};

const toPipelineDetailResource = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap>(
  name: string,
  definition: WPKPipelineDefinition<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
  bufferResources: WPKBufferResources<any, any, any>,
): WPKResource<WPKPipelineDetail> => {
  const { meshFactories, shader, bufferFormats } = definition;
  lazyDebug(LOGGER, () => `Create pipeline detail resource ${name}`);
  if (bufferResources === undefined) {
    throw Error('Error when creating pipeline, no buffer resources');
  }
  const computePipelineDetailsResource = shaderFuncs.isComputeShader(shader)
    ? toComputePipelineDetailsResource(name, shader, () => bufferResources.instanceCount(), bufferFormats, bufferResources)
    : undefined;
  const renderPipelineDetailResource = shaderFuncs.isRenderShader(shader)
    ? toRenderPipelineDetailsResource(name, meshFactories, shader, () => bufferResources.instanceCount(), bufferFormats, bufferResources, isAntiAliasedFunc, textureFormatFunc)
    : undefined;
  lazyDebug(LOGGER, () => `Pipeline ${name} has compute pipeline ${computePipelineDetailsResource !== undefined} has render pipeline ${renderPipelineDetailResource !== undefined}`);
  return {
    get(device, queue, encoder) {
      lazyTrace(LOGGER, () => `Creating pipeline detail ${name}`);
      const instanceCount = bufferResources.instanceCount();
      const pipelineDetail: WPKPipelineDetail = {
        name,
        instanceCount,
      };
      if (instanceCount > 0) {
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
): WPKResource<WPKComputePipelineDetail[]> | undefined => {
  lazyDebug(LOGGER, () => `Creating compute pipeline details resource ${name}`);
  const { compute: { bufferBindings, passes } } = computeShader;
  const visibility = GPUShaderStage.COMPUTE;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, bufferBindings, bufferFormats);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const computeShaderModuleDetail = toComputeShaderModuleDetail(computeShader);
  const computeShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, computeShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, bufferBindings, bufferFormats, bufferResources);
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

const toRenderPipelineDetailsResource = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap>(
  name: string,
  meshFactoryMap: TMeshFactoryMap,
  renderShader: WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<any, any, any>,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
): WPKResource<WPKRenderPipelineDetail[]> | undefined => {
  lazyDebug(LOGGER, () => `Creating render pipeline details resource ${name}`);
  const { render: { bufferBindings, passes } } = renderShader;
  const visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, bufferBindings, bufferFormats);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const renderShaderModuleDetail = toRenderShaderModuleDetail(renderShader);
  const renderShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, renderShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, bufferBindings, bufferFormats, bufferResources);
  const instanceBufferFormats = recordFuncs.filter(bufferFormats, (bufferFormat) => bufferFormat.bufferType === 'entity') as WPKBufferFormatMapEntity<TEntityFormat>;
  const instanceEntityTrackedBufferResources = recordFuncs.filter(bufferResources.buffers, (_, key) => instanceBufferFormats[key as string] !== undefined);
  const renderPipelineDetailResources: WPKResource<WPKRenderPipelineDetail>[] = [];
  for (const [index, renderPass] of passes.entries()) {
    const { mesh: { key, parameters }, fragment, vertex } = renderPass;
    const mesh = meshFactoryMap[key].toMesh(parameters);
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
  lazyDebug(LOGGER, () => 'Creating compute shader module detail');
  const { compute: { passes, shader } } = computeShader;
  return {
    code: shader,
    entryPoints: passes.map(c => c.entryPoint),
  };
};

const toRenderShaderModuleDetail = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap>(
  renderShader: WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>,
): WPKShaderModuleDetail => {
  lazyDebug(LOGGER, () => 'Creating render shader module detail');
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
  lazyDebug(LOGGER, () => 'Creating bind group layout entries');
  return bufferBindings
    .filter((bufferBinding) => bufferBinding.group === group)
    .map((bufferBinding) => {
      const { binding, buffer } = bufferBinding;
      const bufferFormat = bufferFormats[buffer];
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
  lazyDebug(LOGGER, () => 'Calculating buffer binding type');
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
  lazyDebug(LOGGER, () => 'Creating bind group layouts resource');
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
): WPKResource<WPKBindGroupsDetail> => {
  lazyDebug(LOGGER, () => 'Creating bind groups detail resource');
  const maxBindGroup = toMaxBindGroup(bufferBindings);
  const bindGroupDetailResources: WPKResource<WPKBindGroupDetail>[] = [];
  for (let group = 0; group <= maxBindGroup; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(visibility, bufferBindings, bufferFormats, group);
    const bindGroupLayoutResource = pipelineResourceFactory.ofBindGroupLayout(groupName, bindGroupLayoutEntries);
    const bindGroupEntriesResources = toBindGroupEntriesResources(bufferBindings, bufferResources, group);
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
  group: number
): WPKResource<GPUBindGroupEntry>[] => {
  lazyDebug(LOGGER, () => 'Creating bind group entries resources');
  return bufferBindings
    .filter((bufferBinding) => bufferBinding.group === group)
    .map((bufferBinding) => {
      const { binding, buffer } = bufferBinding;
      const bufferResource = bufferResources.buffers[buffer];
      return pipelineResourceFactory.ofBindGroupEntry(binding, bufferResource);
    });
};

const toMaxBindGroup = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormatMap>[]
): number => {
  lazyDebug(LOGGER, () => 'Calculating max bind group');
  return bufferBindings.reduce((max, bufferBinding) => Math.max(max, bufferBinding.group), -1);
};
