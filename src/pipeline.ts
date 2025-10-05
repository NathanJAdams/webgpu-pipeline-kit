import { bufferFactory } from './buffer-factory';
import { bufferFormatFuncs } from './buffer-formats';
import { bufferLayoutsFuncs } from './buffer-layout';
import { bufferResourcesFactory } from './buffer-resources';
import { cacheFactory } from './cache';
import { datumExtractEmbedFactory } from './datum-extract-embed';
import { getLogger } from './logging';
import { meshFuncs } from './mesh-factories';
import { pipelineResourceFactory } from './pipeline-resources';
import { resourceFactory } from './resources';
import { toCodeShaderCompute, toCodeShaderRender } from './shader-code';
import { shaderReserved } from './shader-reserved';
import { shaderFuncs } from './shader-utils';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKReadBackContentMap, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferResizeable, WPKBufferResources, WPKComputePipelineDetail, WPKReadBackFuncs, WPKReadBackOptions, WPKDrawCounts, WPKEntityCache, WPKGroupBinding, WPKGroupIndex, WPKMeshTemplateMap, WPKPipeline, WPKPipelineDetail, WPKPipelineOptions, WPKRenderPipelineDetail, WPKResource, WPKComputeShader, WPKRenderShader, WPKTrackedBuffer, WPKUniformCache, WPKVertexBufferDetail, WPKDispatchResource, WPKBufferLayouts, WPKBufferLayout, WPKBufferFormatType } from './types';
import { logFuncs } from './utils';

const PIPELINE_LOGGER = getLogger('pipeline');
const BUFFER_LOGGER = getLogger('buffer');

export const pipelineFactory = {
  ofCompute: <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean>(
    name: string,
    bufferFormats: TBufferFormatMap,
    shader: WPKComputeShader<TUniform, TEntity, TBufferFormatMap>,
    options: WPKPipelineOptions<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities>,
    readBackOptions: WPKReadBackOptions<TUniform, TEntity, TBufferFormatMap> = {},
  ): WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities, true, false> => {
    checkNotUsingReservedBufferFormats(bufferFormats);
    const uniformCache = cacheFactory.ofUniform(options.mutableUniform, options.initialUniform);
    const entityCache = toEntityCache(options, bufferFormats);
    const bufferLayouts = bufferLayoutsFuncs.toBufferLayouts<TUniform, TEntity, TBufferFormatMap>(bufferFormats, entityCache, isBufferBound(shader.groupBindings), () => false);
    const requiresReadBack = readBackOptions.onReadBack !== undefined;
    const bufferResources = bufferResourcesFactory.ofBufferLayouts<TUniform, TEntity, TBufferFormatMap>(name, uniformCache, entityCache, bufferLayouts, requiresReadBack);
    const dispatchResource = toComputeDispatchResource(name, shader, bufferResources.instanceCount, requiresReadBack);
    const computePipelineDetailsResource = toComputePipelineDetailsResource<TUniform, TEntity, TBufferFormatMap>(name, shader, bufferLayouts, bufferResources, dispatchResource);
    const readBackFuncResource = toReadBackFuncResource(bufferLayouts, bufferResources, dispatchResource, entityCache, readBackOptions);
    const pipelineDetailResource = toPipelineDetailResource<true, false>(name, bufferResources, computePipelineDetailsResource, undefined, readBackFuncResource);
    const pipeline: WPKPipeline<any, any, any, any, any, true, false> = {
      name,
      pipelineDetail(device, queue, encoder) {
        logFuncs.lazyDebug(PIPELINE_LOGGER, () => 'Create pipeline detail');
        pipelineDetailResource.update(device, queue, encoder);
        return pipelineDetailResource.get();
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
    readBackOptions: WPKReadBackOptions<TUniform, TEntity, TBufferFormatMap> = {},
  ): WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities, true, true> => {
    checkNotUsingReservedBufferFormats(bufferFormats);
    const uniformCache = cacheFactory.ofUniform(options.mutableUniform, options.initialUniform);
    const entityCache = toEntityCache(options, bufferFormats);
    const bufferLayouts = bufferLayoutsFuncs.toBufferLayouts<TUniform, TEntity, TBufferFormatMap>(bufferFormats, entityCache, isBufferBound(computeShader.groupBindings, renderShader.groupBindings), isVertexBuffer(renderShader));
    const requiresReadBack = readBackOptions.onReadBack !== undefined;
    const bufferResources = bufferResourcesFactory.ofBufferLayouts<TUniform, TEntity, TBufferFormatMap>(name, uniformCache, entityCache, bufferLayouts, requiresReadBack);
    const dispatchResource = toComputeDispatchResource(name, computeShader, bufferResources.instanceCount, requiresReadBack);
    const computePipelineDetailsResource = toComputePipelineDetailsResource(`${name}-compute`, computeShader, bufferLayouts, bufferResources, dispatchResource);
    const renderPipelineDetailResource = toRenderPipelineDetailsResource(`${name}-render`, meshTemplates, renderShader, bufferResources.instanceCount, bufferLayouts, bufferResources, requiresReadBack);
    const readBackFuncResource = toReadBackFuncResource(bufferLayouts, bufferResources, dispatchResource, entityCache, readBackOptions);
    const pipelineDetailResource = toPipelineDetailResource<true, true>(name, bufferResources, computePipelineDetailsResource, renderPipelineDetailResource, readBackFuncResource);
    const pipeline: WPKPipeline<any, any, any, any, any, true, true> = {
      name,
      pipelineDetail(device, queue, encoder) {
        logFuncs.lazyDebug(PIPELINE_LOGGER, () => 'Create pipeline detail');
        pipelineDetailResource.update(device, queue, encoder);
        return pipelineDetailResource.get();
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
    readBackOptions: WPKReadBackOptions<TUniform, TEntity, TBufferFormatMap> = {},
  ): WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities, false, true> => {
    checkNotUsingReservedBufferFormats(bufferFormats);
    const uniformCache = cacheFactory.ofUniform(options.mutableUniform, options.initialUniform);
    const entityCache = toEntityCache(options, bufferFormats);
    const bufferLayouts = bufferLayoutsFuncs.toBufferLayouts<TUniform, TEntity, TBufferFormatMap>(bufferFormats, entityCache, isBufferBound(shader.groupBindings), isVertexBuffer(shader));
    const requiresReadBack = readBackOptions.onReadBack !== undefined;
    const bufferResources = bufferResourcesFactory.ofBufferLayouts<TUniform, TEntity, TBufferFormatMap>(name, uniformCache, entityCache, bufferLayouts, requiresReadBack);
    const renderPipelineDetailResource = toRenderPipelineDetailsResource(name, meshTemplates, shader, bufferResources.instanceCount, bufferLayouts, bufferResources, requiresReadBack);
    const readBackFuncResource = toReadBackFuncResource(bufferLayouts, bufferResources, undefined, entityCache, readBackOptions);
    const pipelineDetailResource = toPipelineDetailResource<false, true>(name, bufferResources, undefined, renderPipelineDetailResource, readBackFuncResource);
    const pipeline: WPKPipeline<any, any, any, any, any, false, true> = {
      name,
      pipelineDetail(device, queue, encoder) {
        logFuncs.lazyDebug(PIPELINE_LOGGER, () => 'Create pipeline detail');
        pipelineDetailResource.update(device, queue, encoder);
        return pipelineDetailResource.get();
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

const isBufferBound = (...groupBindings: Array<WPKGroupBinding<any, any, any, any, any>>[]) =>
  (bufferName: string): boolean =>
    groupBindings.some(gbs => gbs.some(gb => gb.buffer === bufferName));

const isVertexBuffer = (renderShader: WPKRenderShader<any, any, any, any>) =>
  (bufferName: string): boolean =>
    renderShader.passes.some(pass => pass.vertex.vertexBuffers.some(vertexBuffer => vertexBuffer.buffer === bufferName));

const toPipelineDetailResource = <TCompute extends boolean, TRender extends boolean>(
  name: string,
  bufferResources: WPKBufferResources<any, any, any>,
  computePipelineDetailsResource: TCompute extends true ? WPKResource<WPKComputePipelineDetail[]> : undefined,
  renderPipelineDetailResource: TRender extends true ? WPKResource<WPKRenderPipelineDetail[]> : undefined,
  readBackFuncResource: WPKResource<WPKReadBackFuncs> | undefined,
): WPKResource<WPKPipelineDetail<TCompute, TRender>> => {
  let pipelineDetail: WPKPipelineDetail<TCompute, TRender> | undefined;
  const resource: WPKResource<WPKPipelineDetail<any, any>> = {
    update(device, queue, encoder) {
      logFuncs.lazyTrace(PIPELINE_LOGGER, () => `Creating pipeline details ${name}`);
      bufferResources.update(device, queue, encoder);
      const instanceCount = bufferResources.instanceCount();
      pipelineDetail = {
        name,
        instanceCount,
      } as WPKPipelineDetail<TCompute, TRender>;
      if (instanceCount > 0) {
        if (computePipelineDetailsResource !== undefined) {
          logFuncs.lazyDebug(PIPELINE_LOGGER, () => 'Update compute pipeline');
          computePipelineDetailsResource.update(device, queue, encoder);
          (pipelineDetail as WPKPipelineDetail<true, boolean>).compute = computePipelineDetailsResource.get();
        }
        if (renderPipelineDetailResource !== undefined) {
          logFuncs.lazyDebug(PIPELINE_LOGGER, () => 'Update render pipeline');
          renderPipelineDetailResource.update(device, queue, encoder);
          (pipelineDetail as WPKPipelineDetail<boolean, true>).render = renderPipelineDetailResource.get();
        }
        if (readBackFuncResource !== undefined) {
          logFuncs.lazyDebug(PIPELINE_LOGGER, () => 'Update read back func');
          readBackFuncResource.update(device, queue, encoder);
          pipelineDetail.readBackFuncs = readBackFuncResource.get();
        }
      }
    },
    get() {
      return resourceFactory.getOrThrow(pipelineDetail, `pipeline detail ${name}`);
    },
    clean() {
      computePipelineDetailsResource?.clean();
      renderPipelineDetailResource?.clean();
      readBackFuncResource?.clean();
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
  requiresReadBack: boolean
): WPKDispatchResource<any> => {
  const { passes } = shader;
  const instanceCountResource = resourceFactory.ofFunc(instanceCountFunc);
  const params = pipelineResourceFactory.ofDispatchParams(instanceCountResource, passes);
  const layout = bufferLayoutsFuncs.toBufferLayoutUniform(shaderReserved.DISPATCH_MARSHALLED_FORMAT, GPUBufferUsage.UNIFORM);
  const buffer = bufferResourcesFactory.ofDispatch(name, layout, params, requiresReadBack);
  return {
    layout,
    buffer,
    params,
  };
};

const toComputePipelineDetailsResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  name: string,
  computeShader: WPKComputeShader<TUniform, TEntity, TBufferFormatMap>,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  dispatchResource: WPKDispatchResource<any>,
): WPKResource<WPKComputePipelineDetail[]> => {
  const { groupBindings, passes } = computeShader;
  logFuncs.lazyDebug(PIPELINE_LOGGER, () => `Creating compute pipeline details resource ${name}`);
  const visibility = GPUShaderStage.COMPUTE;
  logFuncs.lazyDebug(PIPELINE_LOGGER, () => `Group bindings: ${JSON.stringify(groupBindings)}`);
  const groupBindingsWithDispatch = [...groupBindings, shaderReserved.DISPATCH_GROUP_BINDING];
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, groupBindingsWithDispatch, bufferLayouts);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const computeShaderModuleDetail = toCodeShaderCompute(computeShader, bufferLayouts);
  const computeShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, computeShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, groupBindingsWithDispatch, bufferLayouts, bufferResources, dispatchResource.buffer);
  const computePipelineDetailResources: WPKResource<WPKComputePipelineDetail>[] = [];
  for (const [index, computePass] of passes.entries()) {
    const { entryPoint } = computePass;
    const dispatchCountResource = pipelineResourceFactory.ofDispatchCount(dispatchResource.params, entryPoint);
    const computePipelineResource = pipelineResourceFactory.ofComputePipeline(name, index, pipelineLayoutResource, computeShaderModuleResource, entryPoint);
    const computeDetailResource = pipelineResourceFactory.ofComputeDetail(bindGroupsDetailResource, computePipelineResource, dispatchCountResource);
    computePipelineDetailResources.push(computeDetailResource);
  }
  return resourceFactory.ofArray(computePipelineDetailResources);
};

const toRenderPipelineDetailsResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap>(
  name: string,
  meshTemplateMap: TMeshTemplateMap,
  renderShader: WPKRenderShader<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
  instanceCountFunc: () => number,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  requiresReadBack: boolean,
): WPKResource<WPKRenderPipelineDetail[]> => {
  logFuncs.lazyDebug(PIPELINE_LOGGER, () => `Creating render pipeline details resource ${name}`);
  const { groupBindings, passes } = renderShader;
  const visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, groupBindings, bufferLayouts);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const renderShaderModuleDetail = toCodeShaderRender(renderShader, bufferLayouts);
  const renderShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, renderShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, groupBindings, bufferLayouts, bufferResources);
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
    const meshBufferResource = bufferResourcesFactory.ofMesh(name, mesh, requiresReadBack);
    const indicesBufferResource: WPKResource<GPUBuffer> = {
      update(device, queue, encoder) {
        meshBufferResource.indices.update(device, queue, encoder);
      },
      get() {
        return meshBufferResource.indices.get().buffer;
      },
      clean() {
        meshBufferResource.indices.clean();
      },
    };
    const vertexBufferDetailResources: WPKResource<WPKVertexBufferDetail>[] = [];
    const detailMesh = pipelineResourceFactory.ofVertexBufferDetailMesh(0, meshBufferResource);
    vertexBufferDetailResources.push(detailMesh);
    const sortedVertexBufferLocationTypes = shaderFuncs.toVertexBufferAttributeData(vertex.vertexBuffers, bufferLayouts);
    sortedVertexBufferLocationTypes.forEach((vertexBufferLocationType) => {
      const detailLocation = pipelineResourceFactory.ofVertexBufferDetailBufferLocationFieldTypes(vertexBufferLocationType, bufferResources);
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
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>
): GPUBindGroupLayoutEntry[] => {
  PIPELINE_LOGGER.info(`buffer layouts ${JSON.stringify(bufferLayouts)}`);
  const entries = groupBindings.filter((groupBinding) => groupBinding.group === group)
    .map((groupBinding) => {
      const { binding, buffer } = groupBinding;
      PIPELINE_LOGGER.info(`group binding ${JSON.stringify(groupBinding)}`);
      const bufferType = (buffer === shaderReserved.DISPATCH_PARAMS_BUFFER_NAME)
        ? 'uniform'
        : bufferLayouts[buffer].bufferType;
      const type = toBufferBindingType(bufferType, visibility);
      logFuncs.lazyDebug(PIPELINE_LOGGER, () => `Creating bind group layout entry for group ${group} binding ${binding}`);
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

const toBufferBindingType = (
  bufferType: WPKBufferFormatType,
  visibility: GPUShaderStageFlags
): GPUBufferBindingType => {
  logFuncs.lazyDebug(PIPELINE_LOGGER, () => `Calculating buffer binding type for buffer type ${JSON.stringify(bufferType)}`);
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
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>
): WPKResource<GPUBindGroupLayout[]> => {
  logFuncs.lazyDebug(PIPELINE_LOGGER, () => 'Creating bind group layouts resource');
  const bindGroupLayoutResources: WPKResource<GPUBindGroupLayout>[] = [];
  for (let group = 0; group <= shaderReserved.MAX_GROUP_INDEX; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(groupBindings, group as WPKGroupIndex, visibility, bufferLayouts);
    if (bindGroupLayoutEntries.length > 0) {
      logFuncs.lazyDebug(PIPELINE_LOGGER, () => `${groupName} entries count: ${bindGroupLayoutEntries.length}`);
      const bindGroupLayoutResource = pipelineResourceFactory.ofBindGroupLayout(groupName, bindGroupLayoutEntries);
      bindGroupLayoutResources[group] = bindGroupLayoutResource;
    }
  }
  logFuncs.lazyDebug(PIPELINE_LOGGER, () => `Creating array resource of ${bindGroupLayoutResources.length} bind group layout resources`);
  return resourceFactory.ofArray(bindGroupLayoutResources);
};

const toBindGroupsDetailResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeUniform extends boolean, TIncludeEntity extends boolean>(
  name: string,
  visibility: GPUShaderStageFlags,
  groupBindings: Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, TIncludeUniform, TIncludeEntity>>,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  dispatchBuffer?: WPKResource<WPKTrackedBuffer>
): WPKResource<WPKBindGroupsDetail> => {
  logFuncs.lazyDebug(PIPELINE_LOGGER, () => 'Creating bind groups detail resource');
  const bindGroupDetailResources: WPKResource<WPKBindGroupDetail>[] = [];
  for (let group = 0; group <= shaderReserved.MAX_GROUP_INDEX; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(groupBindings, group as WPKGroupIndex, visibility, bufferLayouts);
    if (bindGroupLayoutEntries.length > 0) {
      logFuncs.lazyDebug(PIPELINE_LOGGER, () => `${groupName} entries count: ${bindGroupLayoutEntries.length}`);
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
  logFuncs.lazyDebug(PIPELINE_LOGGER, () => `Creating bind group entries resources for group ${group}`);
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

const toReadBackFuncResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  dispatchResource: WPKDispatchResource<any> | undefined,
  entityCache: WPKEntityCache<TEntity, any, any>,
  readBackOptions: WPKReadBackOptions<TUniform, TEntity, TBufferFormatMap>,
): WPKResource<WPKReadBackFuncs> | undefined => {
  logFuncs.lazyDebug(BUFFER_LOGGER, () => 'Checking for onReadBack func');
  const { onReadBack } = readBackOptions;
  if (onReadBack === undefined) {
    logFuncs.lazyDebug(BUFFER_LOGGER, () => 'onReadBack func not found');
    return;
  }
  logFuncs.lazyInfo(BUFFER_LOGGER, () => 'Creating read back function resource');
  const sourceTargetBuffers = {} as Record<string, { layout: WPKBufferLayout<any, any>; source: WPKResource<WPKTrackedBuffer>; target: WPKBufferResizeable & WPKResource<WPKTrackedBuffer>; }>;
  const addSourceTargetBuffers = (bufferName: string, layout: WPKBufferLayout<any, any>, source: WPKResource<WPKTrackedBuffer>): void => {
    const target = bufferFactory.ofResizeable(false, `${bufferName}-readback`, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ, false);
    sourceTargetBuffers[bufferName] = {
      layout,
      source,
      target,
    };
  };
  for (const [bufferName, bufferResourceObj] of Object.entries(bufferResources.buffers)) {
    const layout = bufferLayouts[bufferName];
    addSourceTargetBuffers(bufferName, layout, bufferResourceObj as WPKResource<WPKTrackedBuffer>);
  }
  if (dispatchResource !== undefined) {
    addSourceTargetBuffers(shaderReserved.DISPATCH_PARAMS_BUFFER_NAME, dispatchResource.layout, dispatchResource.buffer);
  }
  let readBackFunc: WPKReadBackFuncs | undefined;
  return {
    update(device, queue, encoder) {
      logFuncs.lazyDebug(BUFFER_LOGGER, () => 'Creating read back function');
      const readBackBuffers = {} as Record<string, { layout: WPKBufferLayout<any, any>; buffer: WPKTrackedBuffer }>;
      for (const [bufferName, { layout, source, target }] of Object.entries(sourceTargetBuffers)) {
        const sourceBuffer = source.get();
        const copyBytesLength = sourceBuffer.bytesLength;
        logFuncs.lazyDebug(BUFFER_LOGGER, () => `Resizing read back buffer ${bufferName}`);
        target.resize(copyBytesLength);
        logFuncs.lazyDebug(BUFFER_LOGGER, () => `Updating read back buffer ${bufferName}`);
        target.update(device, queue, encoder);
        const targetBuffer = target.get();
        logFuncs.lazyDebug(BUFFER_LOGGER, () => `Copying data ${copyBytesLength} bytes from ${sourceBuffer.buffer.label} to read back buffer ${targetBuffer.buffer.label}`);
        encoder.copyBufferToBuffer(sourceBuffer.buffer, 0, targetBuffer.buffer, 0, copyBytesLength);
        readBackBuffers[bufferName] = {
          layout,
          buffer: targetBuffer
        };
      }
      const entityCount = entityCache.count();
      readBackFunc = {
        copyData(encoder) {
          logFuncs.lazyDebug(BUFFER_LOGGER, () => 'Copy data from source buffers to read back buffers');
          for (const { source, target } of Object.values(sourceTargetBuffers)) {
            const sourceBuffer = source.get();
            const targetBuffer = target.get();
            const copyBytesLength = sourceBuffer.bytesLength;
            logFuncs.lazyTrace(BUFFER_LOGGER, () => `Copying data ${copyBytesLength} bytes from ${sourceBuffer.buffer.label} to read back buffer ${targetBuffer.buffer.label}`);
            encoder.copyBufferToBuffer(sourceBuffer.buffer, 0, targetBuffer.buffer, 0, copyBytesLength);
          }
        },
        async readBack() {
          logFuncs.lazyDebug(BUFFER_LOGGER, () => `Read back ${Object.values(readBackBuffers).length} buffers`);
          const contentMap = {} as WPKReadBackContentMap<TUniform, TEntity, TBufferFormatMap>;
          logFuncs.lazyTrace(BUFFER_LOGGER, () => 'Convert read back funcs to promises');
          const promises = Object.entries(readBackBuffers)
            .map(([bufferName, { buffer, layout }]) => {
              const instanceCount = (layout.bufferType === 'uniform')
                ? 1
                : entityCount;
              logFuncs.lazyTrace(BUFFER_LOGGER, () => `Instance count from buffer type ${layout.bufferType} ${instanceCount}`);
              return addInstanceContents(
                bufferName,
                buffer,
                layout,
                instanceCount,
                contentMap);
            });
          await Promise.all(promises);
          logFuncs.lazyTrace(BUFFER_LOGGER, () => 'Invoke onReadBack(contentMap)');
          onReadBack(contentMap);
        },
      };
    },
    get() {
      return resourceFactory.getOrThrow(readBackFunc, 'read back func');
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

const addInstanceContents = async <T>(
  bufferName: string,
  buffer: WPKTrackedBuffer,
  bufferLayout: WPKBufferLayout<T, any>,
  instanceCount: number,
  contentMap: WPKReadBackContentMap<any, any, any>
): Promise<void> => {
  logFuncs.lazyDebug(BUFFER_LOGGER, () => `Synching ${buffer.buffer.label} read back buffer for read`);
  await buffer.buffer.mapAsync(GPUMapMode.READ);
  const mappedRange = buffer.buffer.getMappedRange().slice(0);
  buffer.buffer.unmap();
  const dataView = new DataView(mappedRange);
  logFuncs.lazyTrace(BUFFER_LOGGER, () => `Contents for buffer '${buffer.buffer.label}' bytes: [${new Uint8Array(mappedRange)}]`);
  logFuncs.lazyTrace(BUFFER_LOGGER, () => `Contents for buffer '${buffer.buffer.label}' floats: [${new Float32Array(mappedRange)}]`);
  logFuncs.lazyDebug(BUFFER_LOGGER, () => `Unmarshalling from ${buffer.buffer.label}`);
  const instances = unmarshallToInstances(dataView, bufferLayout, instanceCount);
  contentMap[bufferName] = (bufferLayout.bufferType === 'uniform')
    ? instances[0]
    : instances;
};

export const unmarshallToInstances = <T>(
  dataView: DataView,
  bufferLayout: WPKBufferLayout<T, any>,
  instanceCount: number,
): Record<string, any>[] => {
  const { entries } = bufferLayout;
  const instances: Record<string, any>[] = Array(instanceCount);
  for (let i = 0; i < instanceCount; i++) {
    const instance = {};
    for (const entry of Object.values(entries)) {
      entry.bridge.dataViewToInstance(0, instance, dataView);
    }
    instances[i] = instance;
  }
  return instances;
};
