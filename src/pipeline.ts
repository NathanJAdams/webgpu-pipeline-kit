import { usageToString } from './buffer-factory';
import { bufferFormatFuncs } from './buffer-formats';
import { bufferResourcesFactory } from './buffer-resources';
import { cacheFactory } from './cache';
import { datumExtractorFactory } from './datum-extraction';
import { logFactory } from './logging';
import { meshFuncs } from './mesh-factories';
import { pipelineResourceFactory } from './pipeline-resources';
import { pipelineFuncs } from './pipeline-utils';
import { resourceFactory } from './resources';
import { toCodeShaderCompute, toCodeShaderRender } from './shader-code';
import { DISPATCH_FORMAT, DISPATCH_GROUP_BINDING, DISPATCH_PARAMS_BUFFER_NAME, MAX_GROUP_INDEX } from './shader-reserved';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatType, WPKBufferResources, WPKComputePipelineDetail, WPKDrawCounts, WPKEntityCache, WPKGroupBindingsInternal, WPKGroupIndex, WPKHasBufferFormatType, WPKMeshTemplateMap, WPKPipeline, WPKPipelineDefinition, WPKPipelineDetail, WPKPipelineOptions, WPKRenderPipelineDetail, WPKResource, WPKShader, WPKShaderCompute, WPKShaderRender, WPKUniformCache, WPKVertexBufferDetail } from './types';
import { changeDetectorFactory, logFuncs, recordFuncs } from './utils';

const LOGGER = logFactory.getLogger('pipeline');

export const pipelineFactory = {
  ofDefinition: <
    TUniform,
    TEntity,
    TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
    TMeshTemplateMap extends WPKMeshTemplateMap,
    TMutableUniform extends boolean,
    TMutableEntities extends boolean,
    TResizeableEntities extends boolean,
  >(
    definition: WPKPipelineDefinition<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
    options: WPKPipelineOptions<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities>,
  ): WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities> => {
    const { name, bufferFormats } = definition;
    const uniformCache = cacheFactory.ofUniform(options.mutableUniform, options.initialUniform);
    const entityCache = toEntityCache(options, bufferFormats);
    const isAntiAliasedChangeDetector = changeDetectorFactory.ofTripleEquals<boolean>(true);
    const textureFormatChangeDetector = changeDetectorFactory.ofTripleEquals<GPUTextureFormat>('rgba8unorm');
    const bufferResources = toBufferResources(uniformCache, entityCache, definition);
    const pipelineDetailResource = toPipelineDetailResource(definition, isAntiAliasedChangeDetector.get, textureFormatChangeDetector.get, bufferResources);
    const pipeline: WPKPipeline<any, any, any, any, any> = {
      name,
      pipelineDetail(device, queue, encoder, options) {
        bufferResources.update();
        const { isAntiAliased, textureFormat } = options;
        isAntiAliasedChangeDetector.compareAndUpdate(isAntiAliased);
        textureFormatChangeDetector.compareAndUpdate(textureFormat);
        return pipelineDetailResource.get(device, queue, encoder);
      },
    };
    if (options.mutableUniform) {
      (pipeline as WPKPipeline<TUniform, any, true, any, any>).mutateUniform = (uniform) => (uniformCache as WPKUniformCache<TUniform, true>).mutate(uniform);
    }
    if (options.mutableEntities) {
      if (options.resizeableEntities) {
        (pipeline as WPKPipeline<any, TEntity, any, true, true>).mutateEntityById = (id, entity) => (entityCache as WPKEntityCache<TEntity, true, true>).mutate(id, entity);
      } else {
        (pipeline as WPKPipeline<any, TEntity, any, true, false>).mutateEntityByIndex = (index, entity) => (entityCache as WPKEntityCache<TEntity, true, false>).mutate(index, entity);
      }
    }
    if (options.resizeableEntities) {
      (pipeline as WPKPipeline<any, TEntity, any, any, true>).add = (entity) => (entityCache as WPKEntityCache<TEntity, any, true>).add(entity);
      (pipeline as WPKPipeline<any, TEntity, any, any, true>).remove = (id) => (entityCache as WPKEntityCache<TEntity, any, true>).remove(id);
    }
    return pipeline as WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities>;
  },
};

const toEntityCache = <
  TUniform,
  TEntity,
  TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
  TMutableEntities extends boolean,
  TResizeableEntities extends boolean,
>(options: WPKPipelineOptions<TUniform, TEntity, any, TMutableEntities, TResizeableEntities>, bufferFormats: TBufferFormatMap): WPKEntityCache<any, any, any> => {
  if (options.resizeableEntities) {
    const entityIndexes = bufferFormatFuncs.findFormatEntityIndexes(bufferFormats);
    const entityIndexDatumExtractors = entityIndexes.map(userFormat => datumExtractorFactory.ofEntityId(userFormat));
    const entityCache = cacheFactory.ofEntitiesResizeable(options.mutableEntities, entityIndexDatumExtractors);
    options.initialEntities.forEach(entity => entityCache.add(entity));
    return entityCache;
  } else {
    return cacheFactory.ofEntitiesFixedSize(options.mutableEntities, ...options.initialEntities);
  }
};

const toBufferResources = (uniformCache: WPKUniformCache<any, any>, entityCache: WPKEntityCache<any, any, any>, definition: WPKPipelineDefinition<any, any, any, any>): WPKBufferResources<any, any, any> => {
  const { name } = definition;
  logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for definition ${name}`);
  const { bufferFormats, shader } = definition;
  const bufferUsages = toBufferUsages(shader, bufferFormats);
  return bufferResourcesFactory.ofUniformAndInstances(name, uniformCache, entityCache, bufferFormats, bufferUsages);
};

const toBufferUsages = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  shader: WPKShader<TUniform, TEntity, TBufferFormatMap, any>,
  bufferFormats: TBufferFormatMap,
): Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap>, GPUBufferUsageFlags> => {
  logFuncs.lazyDebug(LOGGER, () => `Calculate buffer usage from buffer formats ${JSON.stringify(Object.keys(bufferFormats))}`);
  return recordFuncs.mapRecord(bufferFormats, (bufferFormat, key) => {
    logFuncs.lazyTrace(LOGGER, () => `Calculate buffer usage from buffer format ${JSON.stringify(key)}`);
    const isBinding = isBufferBound(key, shader.compute?.groupBindings) || isBufferBound(key, shader.render?.groupBindings);
    const isVertex = shader.render !== undefined;
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
      if (isVertex) {
        usage |= GPUBufferUsage.VERTEX;
      }
    }
    logFuncs.lazyTrace(LOGGER, () => `Buffer ${key} has usage ${usageToString(usage)}`);
    if (usage === 0) {
      logFuncs.lazyWarn(LOGGER, () => `Buffer ${key} isn't used`);
    }
    return usage;
  }) as Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap>, GPUBufferUsageFlags>;
};

const isBufferBound = (key: string, groupBindings?: WPKGroupBindingsInternal<any, any, any>): boolean =>
  (groupBindings !== undefined) && groupBindings.some(gb => gb.buffer === key);

const toPipelineDetailResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap>(
  definition: WPKPipelineDefinition<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
  bufferResources: WPKBufferResources<any, any, any>,
): WPKResource<WPKPipelineDetail> => {
  const { name, meshFactories, shader, bufferFormats } = definition;
  const bufferFormatsWithDispatch = {
    ...bufferFormats,
    [DISPATCH_PARAMS_BUFFER_NAME]: DISPATCH_FORMAT,
  };
  logFuncs.lazyDebug(LOGGER, () => `Create pipeline detail resource ${name}`);
  if (bufferResources === undefined) {
    throw Error('Error when creating pipeline, no buffer resources');
  }
  const computePipelineDetailsResource = shader.compute !== undefined
    ? toComputePipelineDetailsResource(name, shader.compute, () => bufferResources.instanceCount(), bufferFormatsWithDispatch, bufferResources)
    : undefined;
  const renderPipelineDetailResource = shader.render !== undefined
    ? toRenderPipelineDetailsResource(name, meshFactories, shader.render, () => bufferResources.instanceCount(), bufferFormatsWithDispatch, bufferResources, isAntiAliasedFunc, textureFormatFunc)
    : undefined;
  logFuncs.lazyDebug(LOGGER, () => `Pipeline ${name} has compute pipeline ${computePipelineDetailsResource !== undefined} has render pipeline ${renderPipelineDetailResource !== undefined}`);
  return {
    get(device, queue, encoder) {
      logFuncs.lazyTrace(LOGGER, () => `Creating pipeline detail ${name}`);
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

const toComputePipelineDetailsResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  name: string,
  computeShader: WPKShaderCompute<TUniform, TEntity, TBufferFormatMap>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<any, any, any>,
): WPKResource<WPKComputePipelineDetail[]> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating compute pipeline details resource ${name}`);
  const { groupBindings, passes } = computeShader;
  const groupBindingsInternal: WPKGroupBindingsInternal<TUniform, TEntity, TBufferFormatMap> = groupBindings;
  groupBindingsInternal.push(DISPATCH_GROUP_BINDING);
  const visibility = GPUShaderStage.COMPUTE;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, groupBindingsInternal, bufferFormats);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const computeShaderModuleDetail = toCodeShaderCompute(computeShader, bufferFormats);
  const computeShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, computeShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, groupBindingsInternal, bufferFormats, bufferResources);
  const computePipelineDetailResources: WPKResource<WPKComputePipelineDetail>[] = [];
  for (const [index, computePass] of passes.entries()) {
    const { entryPoint, workGroupSize } = computePass;
    const computePipelineResource = pipelineResourceFactory.ofComputePipeline(name, index, pipelineLayoutResource, computeShaderModuleResource, entryPoint);
    const dispatchParamsFunc = () => pipelineFuncs.toDispatchParams(workGroupSize, instanceCountFunc());
    const dispatchSizeResource = pipelineResourceFactory.ofDispatchSize(name, dispatchParamsFunc);
    const computeDetailResource = pipelineResourceFactory.ofComputeDetail(bindGroupsDetailResource, computePipelineResource, dispatchSizeResource);
    computePipelineDetailResources.push(computeDetailResource);
  }
  return resourceFactory.ofArray(computePipelineDetailResources);
};

const toRenderPipelineDetailsResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap>(
  name: string,
  meshTemplateMap: TMeshTemplateMap,
  renderShader: WPKShaderRender<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<any, any, any>,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
): WPKResource<WPKRenderPipelineDetail[]> => {
  logFuncs.lazyDebug(LOGGER, () => `Creating render pipeline details resource ${name}`);
  const { groupBindings, passes } = renderShader;
  const visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, groupBindings, bufferFormats);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const renderShaderModuleDetail = toCodeShaderRender(renderShader, bufferFormats);
  const renderShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, renderShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, groupBindings, bufferFormats, bufferResources);
  const renderPipelineDetailResources: WPKResource<WPKRenderPipelineDetail>[] = [];
  for (const [index, renderPass] of passes.entries()) {
    const { mesh: { key, parameters }, fragment, vertex } = renderPass;
    const mesh = meshTemplateMap[key].toMesh(parameters);
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
    const vertexBufferDetailResources: WPKResource<WPKVertexBufferDetail>[] = [
      pipelineResourceFactory.ofVertexBufferDetailMesh(0, meshBufferResource),
    ];
    const vertexBufferDetailsResource = resourceFactory.ofArray(vertexBufferDetailResources);
    const vertexBufferLayoutsResource = pipelineResourceFactory.ofVertexBufferLayouts(vertexBufferDetailsResource);
    const vertexBuffersResource = pipelineResourceFactory.ofVertexBuffers(vertexBufferDetailResources);
    const pipelineResource = pipelineResourceFactory.ofRenderPipeline(name, index, mesh, renderShaderModuleResource, vertex.entryPoint, fragment.entryPoint, vertexBufferLayoutsResource, pipelineLayoutResource, isAntiAliasedFunc, textureFormatFunc);
    const renderPipelineDetailResource = pipelineResourceFactory.ofRenderPipelineDetail(indicesType, bindGroupsDetailResource, indicesBufferResource, vertexBuffersResource, pipelineResource, drawCountsFunc);
    renderPipelineDetailResources.push(renderPipelineDetailResource);
  }
  return resourceFactory.ofArray(renderPipelineDetailResources);
};

const toBindGroupLayoutEntries = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  groupBindings: WPKGroupBindingsInternal<TUniform, TEntity, TBufferFormatMap>,
  group: WPKGroupIndex,
  visibility: GPUShaderStageFlags,
  bufferFormats: TBufferFormatMap,
): GPUBindGroupLayoutEntry[] => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind group layout entries');
  return groupBindings.filter((groupBinding) => groupBinding.group === group)
    .map((groupBinding) => {
      const { binding, buffer } = groupBinding;
      const bufferFormat = bufferFormats[buffer];
      logFuncs.lazyDebug(LOGGER, () => `Calculating buffer binding type for buffer format ${buffer}`);
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

const toBufferBindingType = <TBufferType extends WPKBufferFormatType>(visibility: GPUShaderStageFlags, bufferFormat: WPKHasBufferFormatType<TBufferType>): GPUBufferBindingType => {
  logFuncs.lazyDebug(LOGGER, () => `Calculating buffer binding type for buffer format ${JSON.stringify(bufferFormat)}`);
  const { bufferType } = bufferFormat;
  return bufferType === 'uniform'
    ? 'uniform'
    : (visibility === GPUShaderStage.COMPUTE) && (bufferType === 'editable')
      ? 'storage'
      : 'read-only-storage';
};

const toBindGroupLayoutsResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  name: string,
  visibility: GPUShaderStageFlags,
  groupBindings: WPKGroupBindingsInternal<TUniform, TEntity, TBufferFormatMap>,
  bufferFormats: TBufferFormatMap
): WPKResource<GPUBindGroupLayout[]> => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind group layouts resource');
  const bindGroupLayoutResources: WPKResource<GPUBindGroupLayout>[] = [];
  for (let group = 0; group <= MAX_GROUP_INDEX; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(groupBindings, group as WPKGroupIndex, visibility, bufferFormats);
    const bindGroupLayoutResource = pipelineResourceFactory.ofBindGroupLayout(groupName, bindGroupLayoutEntries);
    bindGroupLayoutResources.push(bindGroupLayoutResource);
  }
  return resourceFactory.ofArray(bindGroupLayoutResources);
};

const toBindGroupsDetailResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  name: string,
  visibility: GPUShaderStageFlags,
  groupBindings: WPKGroupBindingsInternal<TUniform, TEntity, TBufferFormatMap>,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<any, any, any>,
): WPKResource<WPKBindGroupsDetail> => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind groups detail resource');
  const bindGroupDetailResources: WPKResource<WPKBindGroupDetail>[] = [];
  for (let group = 0; group <= MAX_GROUP_INDEX; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(groupBindings, group as WPKGroupIndex, visibility, bufferFormats);
    const bindGroupLayoutResource = pipelineResourceFactory.ofBindGroupLayout(groupName, bindGroupLayoutEntries);
    const bindGroupEntriesResources = toBindGroupEntriesResources(groupBindings, group as WPKGroupIndex, bufferResources);
    const bindGroupEntriesResource = resourceFactory.ofArray(bindGroupEntriesResources);
    const bindGroupResource = pipelineResourceFactory.ofBindGroup(groupName, group as WPKGroupIndex, bindGroupLayoutResource, bindGroupEntriesResource);
    const bindGroupDetailResource = pipelineResourceFactory.ofBindGroupDetail(group as WPKGroupIndex, bindGroupResource);
    bindGroupDetailResources.push(bindGroupDetailResource);
  }
  return resourceFactory.ofArray(bindGroupDetailResources);
};

const toBindGroupEntriesResources = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  groupBindings: WPKGroupBindingsInternal<TUniform, TEntity, TBufferFormatMap>,
  group: WPKGroupIndex,
  bufferResources: WPKBufferResources<any, any, any>,
): WPKResource<GPUBindGroupEntry>[] => {
  logFuncs.lazyDebug(LOGGER, () => `Creating bind group entries resources for group ${group}`);
  return groupBindings.filter(groupBinding => groupBinding.group === group)
    .map((groupBinding) => {
      const { binding, buffer } = groupBinding;
      const bufferResource = bufferResources.buffers[buffer];
      return pipelineResourceFactory.ofBindGroupEntry(binding, bufferResource);
    });
};
