import { bufferFactory, usageToString } from './buffer-factory';
import { bufferFormatFuncs } from './buffer-formats';
import { bufferResourcesFactory } from './buffer-resources';
import { cacheFactory } from './cache';
import { datumBridgeFactory } from './datum-bridge';
import { datumExtractEmbedFactory } from './datum-extract-embed';
import { logFactory } from './logging';
import { meshFuncs } from './mesh-factories';
import { pipelineResourceFactory } from './pipeline-resources';
import { resourceFactory } from './resources';
import { toCodeShaderCompute, toCodeShaderRender } from './shader-code';
import { shaderReserved } from './shader-reserved';
import { shaderFuncs } from './shader-utils';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKDebugBufferContentMap, WPKBufferFormat, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatType, WPKBufferResizeable, WPKBufferResources, WPKComputePipelineDetail, WPKDebugFunc, WPKDebugOptions, WPKDrawCounts, WPKEntityCache, WPKGroupBinding, WPKGroupIndex, WPKHasBufferFormatType, WPKMeshTemplateMap, WPKPipeline, WPKPipelineDetail, WPKPipelineOptions, WPKRenderPipelineDetail, WPKResource, WPKComputeShader, WPKRenderShader, WPKTrackedBuffer, WPKUniformCache, WPKVertexBufferDetail, WPKDispatchResource, WPKBufferFormatUniform, WPKBufferFormatEntityMarshalled, WPKBufferFormatEntityLayout, WPKShaderStage } from './types';
import { logFuncs, recordFuncs } from './utils';

const LOGGER = logFactory.getLogger('pipeline');
const DEBUG_LOGGER = logFactory.getLogger('debug');

export const pipelineFactory = {
  ofCompute: <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean>(
    name: string,
    bufferFormats: TBufferFormatMap,
    shader: WPKComputeShader<TUniform, TEntity, TBufferFormatMap>,
    options: WPKPipelineOptions<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities>,
    debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap> = {},
  ): WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities, true, false> => {
    checkNotUsingReservedBufferFormats(bufferFormats);
    const uniformCache = cacheFactory.ofUniform(options.mutableUniform, options.initialUniform);
    const entityCache = toEntityCache(options, bufferFormats);
    const bufferResources = toBufferResources(name, uniformCache, entityCache, bufferFormats, debug, shader);
    const dispatchResource = toComputeDispatchResource(name, shader, bufferResources.instanceCount, debug.onBufferContents !== undefined);
    const computePipelineDetailsResource = toComputePipelineDetailsResource(name, shader, bufferFormats, bufferResources, dispatchResource);
    const debugFuncResource = toDebugFuncResource(bufferFormats, bufferResources, dispatchResource, entityCache, debug);
    const pipelineDetailResource = toPipelineDetailResource<true, false>(name, bufferResources, computePipelineDetailsResource, undefined, debugFuncResource);
    const pipeline: WPKPipeline<any, any, any, any, any, true, false> = {
      name,
      pipelineDetail(device, queue, encoder) {
        bufferResources.update();
        return pipelineDetailResource.get(device, queue, encoder);
      },
      clean() {
        pipelineDetailResource.clean();
      },
    };
    addPipelineOptions(pipeline, options, uniformCache, entityCache);
    return pipeline as WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities, true, false>;
  },
  ofComputeRender: <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean>(
    name: string,
    bufferFormats: TBufferFormatMap,
    meshTemplates: TMeshTemplateMap,
    computeShader: WPKComputeShader<TUniform, TEntity, TBufferFormatMap>,
    renderShader: WPKRenderShader<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
    options: WPKPipelineOptions<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities>,
    debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap> = {},
  ): WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities, true, true> => {
    checkNotUsingReservedBufferFormats(bufferFormats);
    const uniformCache = cacheFactory.ofUniform(options.mutableUniform, options.initialUniform);
    const entityCache = toEntityCache(options, bufferFormats);
    const debuggable = debug.onBufferContents !== undefined;
    const bufferResources = toBufferResources(name, uniformCache, entityCache, bufferFormats, debug, computeShader, renderShader);
    const dispatchResource = toComputeDispatchResource(name, computeShader, bufferResources.instanceCount, debuggable);
    const computePipelineDetailsResource = toComputePipelineDetailsResource(`${name}-compute`, computeShader, bufferFormats, bufferResources, dispatchResource);
    const renderPipelineDetailResource = toRenderPipelineDetailsResource(`${name}-render`, meshTemplates, renderShader, bufferResources.instanceCount, bufferFormats, bufferResources, debuggable);
    const debugFuncResource = toDebugFuncResource(bufferFormats, bufferResources, dispatchResource, entityCache, debug);
    const pipelineDetailResource = toPipelineDetailResource<true, true>(name, bufferResources, computePipelineDetailsResource, renderPipelineDetailResource, debugFuncResource);
    const pipeline: WPKPipeline<any, any, any, any, any, true, true> = {
      name,
      pipelineDetail(device, queue, encoder) {
        bufferResources.update();
        return pipelineDetailResource.get(device, queue, encoder);
      },
      clean() {
        pipelineDetailResource.clean();
      },
    };
    addPipelineOptions(pipeline, options, uniformCache, entityCache);
    return pipeline as WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities, true, true>;
  },
  ofRender: <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean>(
    name: string,
    bufferFormats: TBufferFormatMap,
    meshTemplates: TMeshTemplateMap,
    shader: WPKRenderShader<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
    options: WPKPipelineOptions<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities>,
    debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap> = {},
  ): WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities, false, true> => {
    checkNotUsingReservedBufferFormats(bufferFormats);
    const uniformCache = cacheFactory.ofUniform(options.mutableUniform, options.initialUniform);
    const entityCache = toEntityCache(options, bufferFormats);
    const bufferResources = toBufferResources(name, uniformCache, entityCache, bufferFormats, debug, shader);
    const renderPipelineDetailResource = toRenderPipelineDetailsResource(name, meshTemplates, shader, bufferResources.instanceCount, bufferFormats, bufferResources, debug.onBufferContents !== undefined);
    const debugFuncResource = toDebugFuncResource(bufferFormats, bufferResources, undefined, entityCache, debug);
    const pipelineDetailResource = toPipelineDetailResource<false, true>(name, bufferResources, undefined, renderPipelineDetailResource, debugFuncResource);
    const pipeline: WPKPipeline<any, any, any, any, any, false, true> = {
      name,
      pipelineDetail(device, queue, encoder) {
        bufferResources.update();
        return pipelineDetailResource.get(device, queue, encoder);
      },
      clean() {
        pipelineDetailResource.clean();
      },
    };
    addPipelineOptions(pipeline, options, uniformCache, entityCache);
    return pipeline as WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities, false, true>;
  },
};

const checkNotUsingReservedBufferFormats = (bufferFormats: WPKBufferFormatMap<any, any>): void => {
  if (Object.keys(bufferFormats).includes(shaderReserved.DISPATCH_PARAMS_BUFFER_NAME)) {
    throw Error(`Cannot use reserved buffer format name ${shaderReserved.DISPATCH_PARAMS_BUFFER_NAME}`);
  }
};

const toEntityCache = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMutableEntities extends boolean, TResizeableEntities extends boolean>(
  options: WPKPipelineOptions<TUniform, TEntity, any, TMutableEntities, TResizeableEntities>,
  bufferFormats: TBufferFormatMap
): WPKEntityCache<any, any, any> => {
  if (options.resizeableEntities) {
    const entityIndexes = bufferFormatFuncs.findFormatEntityIndexes(bufferFormats);
    const entityIndexDatumExtractors = entityIndexes.map(userFormat => datumExtractEmbedFactory.ofEntityId(userFormat.entityIdKey).extract);
    const entityCache = cacheFactory.ofEntitiesResizeable(options.mutableEntities, entityIndexDatumExtractors);
    options.initialEntities.forEach(entity => entityCache.add(entity));
    return entityCache;
  } else {
    return cacheFactory.ofEntitiesFixedSize(options.mutableEntities, ...options.initialEntities);
  }
};

const toBufferResources = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  name: string,
  uniformCache: WPKUniformCache<TUniform, any>,
  entityCache: WPKEntityCache<TEntity, any, any>,
  bufferFormats: TBufferFormatMap,
  debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap>,
  ...shaders: WPKShaderStage<TUniform, TEntity, TBufferFormatMap, any, any>[]
): WPKBufferResources<any, any, any> => {
  logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for definition ${name}`);
  const bufferUsages = toBufferUsages<TUniform, TEntity, TBufferFormatMap>(bufferFormats, ...shaders);
  return bufferResourcesFactory.ofUniformAndInstances(name, uniformCache, entityCache, bufferFormats, bufferUsages, debug.onBufferContents !== undefined);
};

const toBufferUsages = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  bufferFormats: TBufferFormatMap,
  ...shaders: WPKShaderStage<TUniform, TEntity, TBufferFormatMap, any, any>[]
): Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, boolean, boolean>, GPUBufferUsageFlags> => {
  logFuncs.lazyDebug(LOGGER, () => `Calculate buffer usage from buffer formats ${JSON.stringify(Object.keys(bufferFormats))}`);
  return recordFuncs.mapRecord(bufferFormats, (bufferFormat, key) => {
    logFuncs.lazyTrace(LOGGER, () => `Calculate buffer usage from buffer format ${JSON.stringify(key)}`);
    const isBinding = shaders.some(shader => isBufferBound(key, shader.groupBindings));
    const isVertex = shaders !== undefined; // TODO check buffer locations for render shaders
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
  }) as Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, boolean, boolean>, GPUBufferUsageFlags>;
};

const isBufferBound = (key: string, groupBindings?: Array<WPKGroupBinding<any, any, any, any, any>>): boolean =>
  (groupBindings !== undefined) && groupBindings.some(gb => gb.buffer === key);

const toPipelineDetailResource = <TCompute extends boolean, TRender extends boolean>(
  name: string,
  bufferResources: WPKBufferResources<any, any, any>,
  computePipelineDetailsResource: TCompute extends true ? WPKResource<WPKComputePipelineDetail[]> : undefined,
  renderPipelineDetailResource: TRender extends true ? WPKResource<WPKRenderPipelineDetail[]> : undefined,
  debugFuncResource: WPKResource<WPKDebugFunc> | undefined,
): WPKResource<WPKPipelineDetail<TCompute, TRender>> => {
  const resource: WPKResource<WPKPipelineDetail<any, any>> = {
    get(device, queue, encoder) {
      logFuncs.lazyTrace(LOGGER, () => `Creating pipeline details ${name}`);
      const instanceCount = bufferResources.instanceCount();
      const pipelineDetail: WPKPipelineDetail<boolean, boolean> = {
        name,
        instanceCount,
      };
      if (instanceCount > 0) {
        if (computePipelineDetailsResource !== undefined) {
          (pipelineDetail as WPKPipelineDetail<true, boolean>).compute = computePipelineDetailsResource.get(device, queue, encoder);
        }
        if (renderPipelineDetailResource !== undefined) {
          (pipelineDetail as WPKPipelineDetail<boolean, true>).render = renderPipelineDetailResource.get(device, queue, encoder);
        }
        if (debugFuncResource !== undefined) {
          pipelineDetail.debugFunc = debugFuncResource.get(device, queue, encoder);
        }
      }
      return pipelineDetail;
    },
    clean() {
      computePipelineDetailsResource?.clean();
      renderPipelineDetailResource?.clean();
      debugFuncResource?.clean();
      Object.values(bufferResources.buffers).forEach(resource => resource.clean());
    },
  };
  return resource as WPKResource<WPKPipelineDetail<TCompute, TRender>>;
};

const addPipelineOptions = <TUniform, TEntity, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean>(
  pipeline: WPKPipeline<any, any, any, any, any, any, any>,
  options: WPKPipelineOptions<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities>,
  uniformCache: WPKUniformCache<TUniform, TMutableUniform>,
  entityCache: WPKEntityCache<TEntity, TMutableEntities, any>,
): void => {
  if (options.mutableUniform) {
    (pipeline as WPKPipeline<TUniform, any, true, any, any, any, any>).mutateUniform = (uniform) => (uniformCache as WPKUniformCache<TUniform, true>).mutate(uniform);
  }
  if (options.mutableEntities) {
    if (options.resizeableEntities) {
      (pipeline as WPKPipeline<any, TEntity, any, true, true, any, any>).mutateEntityById = (id, entity) => (entityCache as WPKEntityCache<TEntity, true, true>).mutate(id, entity);
    } else {
      (pipeline as WPKPipeline<any, TEntity, any, true, false, any, any>).mutateEntityByIndex = (index, entity) => (entityCache as WPKEntityCache<TEntity, true, false>).mutate(index, entity);
    }
  }
  if (options.resizeableEntities) {
    (pipeline as WPKPipeline<any, TEntity, any, any, true, any, any>).add = (entity) => (entityCache as WPKEntityCache<TEntity, any, true>).add(entity);
    (pipeline as WPKPipeline<any, TEntity, any, any, true, any, any>).remove = (id) => (entityCache as WPKEntityCache<TEntity, any, true>).remove(id);
  }
};

const toComputeDispatchResource = (
  name: string,
  shader: WPKComputeShader<any, any, any>,
  instanceCountFunc: () => number,
  debuggable: boolean
): WPKDispatchResource<any> => {
  const { passes } = shader;
  const instanceCountResource = resourceFactory.ofFunc(instanceCountFunc);
  const params = pipelineResourceFactory.ofDispatchParams(instanceCountResource, passes);
  const entryPoints = passes.map(pass => pass.entryPoint);
  const format = shaderReserved.createDispatchFormat(entryPoints);
  const marshaller = shaderReserved.createDispatchMarshaller(format);
  const buffer = bufferResourcesFactory.ofDispatch(name, format, params, marshaller, debuggable);
  return {
    format,
    buffer,
    params,
  };
};

const toComputePipelineDetailsResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  name: string,
  computeShader: WPKComputeShader<TUniform, TEntity, TBufferFormatMap>,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  dispatchResource: WPKDispatchResource<any>,
): WPKResource<WPKComputePipelineDetail[]> => {
  const { groupBindings, passes } = computeShader;
  logFuncs.lazyDebug(LOGGER, () => `Creating compute pipeline details resource ${name}`);
  const visibility = GPUShaderStage.COMPUTE;
  logFuncs.lazyDebug(LOGGER, () => `Group bindings: ${JSON.stringify(groupBindings)}`);
  const groupBindingsWithDispatch = [...groupBindings, shaderReserved.DISPATCH_GROUP_BINDING];
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, groupBindingsWithDispatch, bufferFormats);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const computeShaderModuleDetail = toCodeShaderCompute(computeShader, bufferFormats);
  const computeShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, computeShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, groupBindingsWithDispatch, bufferFormats, bufferResources, dispatchResource.buffer);
  const computePipelineDetailResources: WPKResource<WPKComputePipelineDetail>[] = [];
  for (const [index, computePass] of passes.entries()) {
    const { entryPoint } = computePass;
    const dispatchSizeResource = pipelineResourceFactory.ofDispatchSize(dispatchResource.params, entryPoint);
    const computePipelineResource = pipelineResourceFactory.ofComputePipeline(name, index, pipelineLayoutResource, computeShaderModuleResource, entryPoint);
    const computeDetailResource = pipelineResourceFactory.ofComputeDetail(bindGroupsDetailResource, computePipelineResource, dispatchSizeResource);
    computePipelineDetailResources.push(computeDetailResource);
  }
  return resourceFactory.ofArray(computePipelineDetailResources);
};

const toRenderPipelineDetailsResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap>(
  name: string,
  meshTemplateMap: TMeshTemplateMap,
  renderShader: WPKRenderShader<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  debuggable: boolean,
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
    const meshBufferResource = bufferResourcesFactory.ofMesh(name, mesh, debuggable);
    const indicesBufferResource: WPKResource<GPUBuffer> = {
      get(device, queue, encoder) {
        return meshBufferResource.indices.get(device, queue, encoder).buffer;
      },
      clean() {
        meshBufferResource.indices.clean();
      },
    };
    const vertexBufferDetailResources: WPKResource<WPKVertexBufferDetail>[] = [];
    const detailMesh = pipelineResourceFactory.ofVertexBufferDetailMesh(0, meshBufferResource);
    vertexBufferDetailResources.push(detailMesh);
    const sortedVertexBufferLocationTypes = shaderFuncs.toVertexBufferAttributeData(vertex.vertexBuffers, bufferFormats);
    sortedVertexBufferLocationTypes.forEach((vertexBufferLocationType) => {
      const detailLocation = pipelineResourceFactory.ofVertexBufferDetailBufferLocationFieldTypes(vertexBufferLocationType, bufferFormats, bufferResources);
      vertexBufferDetailResources.push(detailLocation);
    });
    const vertexBufferDetailsResource = resourceFactory.ofArray(vertexBufferDetailResources);
    const vertexBufferLayoutsResource = pipelineResourceFactory.ofVertexBufferLayouts(vertexBufferDetailsResource);
    const vertexBuffersResource = pipelineResourceFactory.ofVertexBuffers(vertexBufferDetailResources);
    const pipelineResource = pipelineResourceFactory.ofRenderPipeline(name, index, mesh, renderShaderModuleResource, vertex.entryPoint, fragment.entryPoint, vertexBufferLayoutsResource, pipelineLayoutResource);
    const renderPipelineDetailResource = pipelineResourceFactory.ofRenderPipelineDetail(indicesType, bindGroupsDetailResource, indicesBufferResource, vertexBuffersResource, pipelineResource, drawCountsFunc);
    renderPipelineDetailResources.push(renderPipelineDetailResource);
  }
  return resourceFactory.ofArray(renderPipelineDetailResources);
};

const toBindGroupLayoutEntries = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeUniform extends boolean, TIncludeEntity extends boolean>(
  groupBindings: Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, TIncludeUniform, TIncludeEntity>>,
  group: WPKGroupIndex,
  visibility: GPUShaderStageFlags,
  bufferFormats: TBufferFormatMap
): GPUBindGroupLayoutEntry[] => {
  const entries = groupBindings.filter((groupBinding) => groupBinding.group === group)
    .map((groupBinding) => {
      const { binding, buffer } = groupBinding;
      const type = (buffer === shaderReserved.DISPATCH_PARAMS_BUFFER_NAME)
        ? 'uniform'
        : toBufferBindingType(visibility, bufferFormats[buffer]);
      logFuncs.lazyDebug(LOGGER, () => `Creating bind group layout entry for group ${group} binding ${binding}`);
      return {
        binding,
        visibility,
        buffer: {
          type
        },
      };
    });
  return entries;
};

const toBufferBindingType = <TBufferType extends WPKBufferFormatType>(
  visibility: GPUShaderStageFlags,
  bufferFormat: WPKHasBufferFormatType<TBufferType>
): GPUBufferBindingType => {
  logFuncs.lazyDebug(LOGGER, () => `Calculating buffer binding type for buffer format ${JSON.stringify(bufferFormat)}`);
  const { bufferType } = bufferFormat;
  return bufferType === 'uniform'
    ? 'uniform'
    : (visibility === GPUShaderStage.COMPUTE) && (bufferType === 'editable')
      ? 'storage'
      : 'read-only-storage';
};

const toBindGroupLayoutsResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeUniform extends boolean, TIncludeEntity extends boolean>(
  name: string,
  visibility: GPUShaderStageFlags,
  groupBindings: Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, TIncludeUniform, TIncludeEntity>>,
  bufferFormats: TBufferFormatMap
): WPKResource<GPUBindGroupLayout[]> => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind group layouts resource');
  const bindGroupLayoutResources: WPKResource<GPUBindGroupLayout>[] = [];
  for (let group = 0; group <= shaderReserved.MAX_GROUP_INDEX; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(groupBindings, group as WPKGroupIndex, visibility, bufferFormats);
    if (bindGroupLayoutEntries.length > 0) {
      logFuncs.lazyDebug(LOGGER, () => `${groupName} entries count: ${bindGroupLayoutEntries.length}`);
      const bindGroupLayoutResource = pipelineResourceFactory.ofBindGroupLayout(groupName, bindGroupLayoutEntries);
      bindGroupLayoutResources[group] = bindGroupLayoutResource;
    }
  }
  logFuncs.lazyDebug(LOGGER, () => `Creating array resource of ${bindGroupLayoutResources.length} bind group layout resources`);
  return resourceFactory.ofArray(bindGroupLayoutResources);
};

const toBindGroupsDetailResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeUniform extends boolean, TIncludeEntity extends boolean>(
  name: string,
  visibility: GPUShaderStageFlags,
  groupBindings: Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, TIncludeUniform, TIncludeEntity>>,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  dispatchBuffer?: WPKResource<WPKTrackedBuffer>
): WPKResource<WPKBindGroupsDetail> => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind groups detail resource');
  const bindGroupDetailResources: WPKResource<WPKBindGroupDetail>[] = [];
  for (let group = 0; group <= shaderReserved.MAX_GROUP_INDEX; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(groupBindings, group as WPKGroupIndex, visibility, bufferFormats);
    if (bindGroupLayoutEntries.length > 0) {
      logFuncs.lazyDebug(LOGGER, () => `${groupName} entries count: ${bindGroupLayoutEntries.length}`);
      const bindGroupLayoutResource = pipelineResourceFactory.ofBindGroupLayout(groupName, bindGroupLayoutEntries);
      const bindGroupEntriesResources = toBindGroupEntriesResources(groupBindings, group as WPKGroupIndex, bufferResources, dispatchBuffer);
      const bindGroupEntriesResource = resourceFactory.ofArray(bindGroupEntriesResources);
      const bindGroupResource = pipelineResourceFactory.ofBindGroup(groupName, bindGroupLayoutResource, bindGroupEntriesResource);
      const bindGroupDetailResource = pipelineResourceFactory.ofBindGroupDetail(group as WPKGroupIndex, bindGroupResource);
      bindGroupDetailResources.push(bindGroupDetailResource);
    }
  }
  return resourceFactory.ofArray(bindGroupDetailResources);
};

const toBindGroupEntriesResources = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeUniform extends boolean, TIncludeEntity extends boolean>(
  groupBindings: Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, TIncludeUniform, TIncludeEntity>>,
  group: WPKGroupIndex,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  dispatchBuffer?: WPKResource<WPKTrackedBuffer>
): WPKResource<GPUBindGroupEntry>[] => {
  logFuncs.lazyDebug(LOGGER, () => `Creating bind group entries resources for group ${group}`);
  return groupBindings.filter(groupBinding => groupBinding.group === group)
    .map((groupBinding) => {
      const { binding, buffer } = groupBinding;
      const bufferResource = (buffer === shaderReserved.DISPATCH_PARAMS_BUFFER_NAME)
        ? dispatchBuffer
        : bufferResources.buffers[buffer as WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>];
      if (bufferResource === undefined) {
        throw Error(`Failed to find buffer resource for ${buffer}`);
      }
      return pipelineResourceFactory.ofBindGroupEntry(binding, bufferResource);
    });
};

const toDebugFuncResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  dispatchResource: WPKDispatchResource<any> | undefined,
  entityCache: WPKEntityCache<TEntity, any, any>,
  debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap>,
): WPKResource<WPKDebugFunc> | undefined => {
  const { onBufferContents } = debug;
  if (onBufferContents === undefined) {
    return;
  }
  logFuncs.lazyInfo(DEBUG_LOGGER, () => 'Creating debug function resource');
  const sourceTargetBuffers = {} as Record<string, { format: WPKBufferFormat<any, any>; source: WPKResource<WPKTrackedBuffer>; target: WPKBufferResizeable & WPKResource<WPKTrackedBuffer>; }>;
  const addSourceTargetBuffers = (name: string, format: WPKBufferFormat<any, any>, source: WPKResource<WPKTrackedBuffer>): void => {
    const target = bufferFactory.ofResizeable(false, `${name}-debug`, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ, false);
    sourceTargetBuffers[name] = {
      format,
      source,
      target,
    };
  };
  for (const [name, bufferResourceObj] of Object.entries(bufferResources.buffers)) {
    const format = bufferFormats[name];
    addSourceTargetBuffers(name, format, bufferResourceObj as WPKResource<WPKTrackedBuffer>);
  }
  if (dispatchResource !== undefined) {
    addSourceTargetBuffers(shaderReserved.DISPATCH_PARAMS_BUFFER_NAME, dispatchResource.format, dispatchResource.buffer);
  }
  return {
    get(device, queue, encoder) {
      logFuncs.lazyDebug(DEBUG_LOGGER, () => 'Creating debug function');
      const debugBuffers = {} as Record<string, { format: WPKBufferFormat<any, any>; buffer: GPUBuffer }>;
      for (const [bufferName, { format, source, target }] of Object.entries(sourceTargetBuffers)) {
        const sourceBuffer = source.get(device, queue, encoder);
        const copyBytesLength = sourceBuffer.bytesLength;
        target.resize(copyBytesLength);
        const targetBuffer = target.get(device, queue, encoder);
        logFuncs.lazyDebug(DEBUG_LOGGER, () => `Copying data ${copyBytesLength} bytes from ${sourceBuffer.buffer.label} to debug buffer ${targetBuffer.buffer.label}`);
        encoder.copyBufferToBuffer(sourceBuffer.buffer, 0, targetBuffer.buffer, 0, copyBytesLength);
        debugBuffers[bufferName] = {
          format,
          buffer: targetBuffer.buffer
        };
      }
      const entityCount = entityCache.count();
      const debugFunc: WPKDebugFunc = async (): Promise<void> => {
        const contentMap = {} as WPKDebugBufferContentMap<TUniform, TEntity, TBufferFormatMap>;
        const promises = Object.entries(debugBuffers)
          .map(([bufferName, { format, buffer }]) =>
            addContents(
              bufferName,
              buffer,
              format,
              entityCache,
              entityCount,
              contentMap));
        await Promise.all(promises);
        await onBufferContents(contentMap);
      };
      return debugFunc;
    },
    clean() {
      Object.values(sourceTargetBuffers).forEach(sourceTargetBuffer => {
        sourceTargetBuffer.source.clean();
        sourceTargetBuffer.target.clean();
      });
      dispatchResource?.buffer.clean();
    },
  };
};

const addContents = async (
  bufferName: string,
  buffer: GPUBuffer,
  bufferFormat: WPKBufferFormat<any, any>,
  entityCache: WPKEntityCache<any, any, any>,
  entityCount: number,
  contentMap: WPKDebugBufferContentMap<any, any, any>
): Promise<void> => {
  logFuncs.lazyDebug(DEBUG_LOGGER, () => `Synching ${bufferName} debug buffer for read`);
  await buffer.mapAsync(GPUMapMode.READ);
  const mappedRange = buffer.getMappedRange().slice(0);
  buffer.unmap();
  const dataView = new DataView(mappedRange);
  logFuncs.lazyTrace(LOGGER, () => `${bufferName} contents: ${new Float32Array(mappedRange)}`);
  const { bufferType } = bufferFormat;
  if (bufferType === 'uniform') {
    logFuncs.lazyDebug(DEBUG_LOGGER, () => `Unmarshalling uniform from ${bufferName}`);
    const uniform = unmarshallUniform(dataView, bufferFormat);
    logFuncs.lazyTrace(DEBUG_LOGGER, () => `Unmarshalled uniform from format ${bufferName}`);
    contentMap[bufferName] = uniform;
  } else if (bufferType === 'marshalled') {
    logFuncs.lazyDebug(DEBUG_LOGGER, () => `Unmarshalling entities from format ${bufferName}`);
    const entities = unmarshallEntityMarshalledArray(dataView, bufferFormat, entityCache, entityCount);
    logFuncs.lazyTrace(DEBUG_LOGGER, () => `Unmarshalled ${entities.length} entities from format ${bufferName}`);
    contentMap[bufferName] = entities;
  } else if (bufferType === 'editable') {
    logFuncs.lazyDebug(DEBUG_LOGGER, () => `Unmarshalling entities from layout ${bufferName}`);
    const entities = unmarshallEntityLayoutArray(dataView, bufferFormat, entityCount);
    logFuncs.lazyTrace(DEBUG_LOGGER, () => `Unmarshalled ${entities.length} entities from format ${bufferName}`);
    contentMap[bufferName] = entities;
  }
};

export const unmarshallUniform = <TUniform>(dataView: DataView, bufferFormat: WPKBufferFormatUniform<TUniform>): TUniform => {
  const { marshall } = bufferFormat;
  const uniform = {} as TUniform;
  let datumOffset = 0;
  for (const entry of marshall) {
    const bridge = datumBridgeFactory.ofFormatElement(entry, datumOffset);
    bridge.dataViewToInstance(0, uniform, dataView);
    datumOffset += bridge.stride;
  }
  return uniform;
};

export const unmarshallEntityMarshalledArray = <TEntity, TMutable extends boolean, TResizeable extends boolean>(
  dataView: DataView,
  bufferFormat: WPKBufferFormatEntityMarshalled<TEntity>,
  entityCache: WPKEntityCache<TEntity, TMutable, TResizeable>,
  entityCount: number
): TEntity[] => {
  const { marshall } = bufferFormat;
  const formatStride = shaderFuncs.toStrideArray(marshall);
  const entities: TEntity[] = Array(entityCount);
  for (let i = 0; i < entityCount; i++) {
    const dataViewOffset = i * formatStride;
    const entity = {} as TEntity;
    let datumOffset = 0;
    for (const entry of marshall) {
      const bridge = datumBridgeFactory.ofFormatElement(entry, datumOffset, entityCache);
      bridge.dataViewToInstance(dataViewOffset, entity, dataView);
      datumOffset += bridge.stride;
    }
    entities[i] = entity;
  }
  return entities;
};

export const unmarshallEntityLayoutArray = (
  dataView: DataView,
  bufferFormat: WPKBufferFormatEntityLayout,
  entityCount: number
): object[] => {
  const { layout } = bufferFormat;
  const formatStride = shaderFuncs.toStrideArray(layout);
  const entities = Array(entityCount);
  for (let i = 0; i < entityCount; i++) {
    const dataViewOffset = i * formatStride;
    const entity = {};
    let datumOffset = 0;
    for (const entry of layout) {
      const bridge = datumBridgeFactory.ofStructEntry(entry, datumOffset);
      bridge.dataViewToInstance(dataViewOffset, entity, dataView);
      datumOffset += bridge.stride;
    }
    entities[i] = entity;
  }
  return entities;
};
