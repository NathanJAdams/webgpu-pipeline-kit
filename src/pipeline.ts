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
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKDebugBufferContentMap, WPKBufferFormat, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatType, WPKBufferResizeable, WPKBufferResources, WPKComputePipelineDetail, WPKDebugFunc, WPKDebugOptions, WPKDrawCounts, WPKEntityCache, WPKGroupBinding, WPKGroupIndex, WPKHasBufferFormatType, WPKMeshTemplateMap, WPKPipeline, WPKPipelineDefinition, WPKPipelineDetail, WPKPipelineOptions, WPKRenderPipelineDetail, WPKResource, WPKShader, WPKShaderStageCompute, WPKShaderStageRender, WPKTrackedBuffer, WPKUniformCache, WPKVertexBufferDetail, WPKDispatchResource, WPKBufferFormatUniform, WPKBufferFormatEntityMarshalled, WPKBufferFormatEntityLayout } from './types';
import { changeDetectorFactory, logFuncs, recordFuncs } from './utils';

const LOGGER = logFactory.getLogger('pipeline');
const DEBUG_LOGGER = logFactory.getLogger('debug');

export const pipelineFactory = {
  ofDefinition: <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean>(
    definition: WPKPipelineDefinition<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
    options: WPKPipelineOptions<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities>,
    debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap> = {},
  ): WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities> => {
    if (Object.keys(definition.bufferFormats).includes(shaderReserved.DISPATCH_PARAMS_BUFFER_NAME)) {
      throw Error(`Cannot use reserved buffer format name ${shaderReserved.DISPATCH_PARAMS_BUFFER_NAME}`);
    }
    const { name, bufferFormats } = definition;
    const uniformCache = cacheFactory.ofUniform(options.mutableUniform, options.initialUniform);
    const entityCache = toEntityCache(options, bufferFormats);
    const isAntiAliasedChangeDetector = changeDetectorFactory.ofTripleEquals<boolean>(true);
    const textureFormatChangeDetector = changeDetectorFactory.ofTripleEquals<GPUTextureFormat>('rgba8unorm');
    const bufferResources = toBufferResources(uniformCache, entityCache, definition, debug);
    const pipelineDetailResource = toPipelineDetailResource(definition, isAntiAliasedChangeDetector.get, textureFormatChangeDetector.get, bufferResources, debug);
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
  uniformCache: WPKUniformCache<TUniform, any>,
  entityCache: WPKEntityCache<TEntity, any, any>,
  definition: WPKPipelineDefinition<TUniform, TEntity, TBufferFormatMap, any>,
  debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap>
): WPKBufferResources<any, any, any> => {
  const { bufferFormats, name, shader } = definition;
  logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for definition ${name}`);
  const bufferUsages = toBufferUsages(shader, bufferFormats);
  return bufferResourcesFactory.ofUniformAndInstances(name, uniformCache, entityCache, bufferFormats, bufferUsages, debug.onBufferContents !== undefined);
};

const toBufferUsages = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  shader: WPKShader<TUniform, TEntity, TBufferFormatMap, any>,
  bufferFormats: TBufferFormatMap,
): Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, boolean, boolean>, GPUBufferUsageFlags> => {
  logFuncs.lazyDebug(LOGGER, () => `Calculate buffer usage from buffer formats ${JSON.stringify(Object.keys(bufferFormats))}`);
  return recordFuncs.mapRecord(bufferFormats, (bufferFormat, key) => {
    logFuncs.lazyTrace(LOGGER, () => `Calculate buffer usage from buffer format ${JSON.stringify(key)}`);
    const isBinding = isBufferBound(key, shader.compute?.groupBindings) || isBufferBound(key, shader.render?.groupBindings);
    const isVertex = shader.render !== undefined; // TODO check buffer locations instead of blanket use
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

const toPipelineDetailResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<any, any>, TMeshTemplateMap extends WPKMeshTemplateMap>(
  definition: WPKPipelineDefinition<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
  bufferResources: WPKBufferResources<any, any, any>,
  debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap>,
): WPKResource<WPKPipelineDetail> => {
  const { name, meshFactories, shader, bufferFormats } = definition;
  logFuncs.lazyDebug(LOGGER, () => `Create pipeline detail resource ${name}`);
  if (bufferResources === undefined) {
    throw Error('Error when creating pipeline, no buffer resources');
  }
  let computePipelineDetailsResource: WPKResource<WPKComputePipelineDetail[]> | undefined;
  let renderPipelineDetailResource: WPKResource<WPKRenderPipelineDetail[]> | undefined;
  let dispatchResource: WPKDispatchResource<any> | undefined;
  const instanceCountFunc = bufferResources.instanceCount;
  const debuggable = debug.onBufferContents !== undefined;
  const { compute, render } = shader;
  if (compute !== undefined) {
    const { passes } = compute;
    const instanceCountResource = resourceFactory.ofFunc(instanceCountFunc);
    const params = pipelineResourceFactory.ofDispatchParams(instanceCountResource, passes);
    const entryPoints = passes.map(pass => pass.entryPoint);
    const format = shaderReserved.createDispatchFormat(entryPoints);
    const marshaller = shaderReserved.createDispatchMarshaller(format);
    const buffer = bufferResourcesFactory.ofDispatch(name, format, params, marshaller, debuggable);
    dispatchResource = {
      format,
      buffer,
      params,
    };
    computePipelineDetailsResource = toComputePipelineDetailsResource(name, compute, bufferFormats, bufferResources, dispatchResource);
  }
  if (render !== undefined) {
    renderPipelineDetailResource = toRenderPipelineDetailsResource(name, meshFactories, render, instanceCountFunc, bufferFormats, bufferResources, isAntiAliasedFunc, textureFormatFunc, debuggable);
  }
  logFuncs.lazyDebug(LOGGER, () => `Pipeline ${name} has compute pipeline ${computePipelineDetailsResource !== undefined} has render pipeline ${renderPipelineDetailResource !== undefined}`);
  const debugFuncResource = toDebugFuncResource(bufferFormats, bufferResources, dispatchResource, debug);
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
        if (debugFuncResource !== undefined) {
          pipelineDetail.debugFunc = debugFuncResource.get(device, queue, encoder);
        }
      }
      return pipelineDetail;
    },
  };
};

const toComputePipelineDetailsResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  name: string,
  computeShader: WPKShaderStageCompute<TUniform, TEntity, TBufferFormatMap>,
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
  renderShader: WPKShaderStageRender<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
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
    const pipelineResource = pipelineResourceFactory.ofRenderPipeline(name, index, mesh, renderShaderModuleResource, vertex.entryPoint, fragment.entryPoint, vertexBufferLayoutsResource, pipelineLayoutResource, isAntiAliasedFunc, textureFormatFunc);
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
        logFuncs.lazyDebug(DEBUG_LOGGER, () => `Copying data ${copyBytesLength} bytes from ${bufferName} to debug buffer`);
        encoder.copyBufferToBuffer(sourceBuffer.buffer, 0, targetBuffer.buffer, 0, copyBytesLength);
        debugBuffers[bufferName] = {
          format,
          buffer: targetBuffer.buffer
        };
      }
      const debugFunc: WPKDebugFunc = async (): Promise<void> => {
        const contentMap = {} as WPKDebugBufferContentMap<TUniform, TEntity, TBufferFormatMap>;
        const promises = Object.entries(debugBuffers)
          .map(([bufferName, { format, buffer }]) =>
            addContents(
              bufferName,
              buffer,
              format,
              contentMap));
        await Promise.all(promises);
        await onBufferContents(contentMap);
      };
      return debugFunc;
    },
  };
};

const addContents = async (
  bufferName: string,
  buffer: GPUBuffer,
  bufferFormat: WPKBufferFormat<any, any>,
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
    const entities = unmarshallEntityMarshalledArray(dataView, bufferFormat);
    logFuncs.lazyTrace(DEBUG_LOGGER, () => `Unmarshalled ${entities.length} entities from format ${bufferName}`);
    contentMap[bufferName] = entities;
  } else if (bufferType === 'editable') {
    logFuncs.lazyDebug(DEBUG_LOGGER, () => `Unmarshalling entities from layout ${bufferName}`);
    const entities = unmarshallEntityLayoutArray(dataView, bufferFormat);
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

export const unmarshallEntityMarshalledArray = <TEntity>(dataView: DataView, bufferFormat: WPKBufferFormatEntityMarshalled<TEntity>): TEntity[] => {
  const { marshall } = bufferFormat;
  const formatStride = shaderFuncs.toStrideArray(marshall);
  const entityCount = Math.floor(dataView.byteLength / formatStride);
  const entities: TEntity[] = Array(entityCount);
  for (let i = 0; i < entityCount; i++) {
    const dataViewOffset = i * formatStride;
    const entity = {} as TEntity;
    let datumOffset = 0;
    for (const entry of marshall) {
      const bridge = datumBridgeFactory.ofFormatElement(entry, datumOffset);
      bridge.dataViewToInstance(dataViewOffset, entity, dataView);
      datumOffset += bridge.stride;
    }
    entities.push(entity);
  }
  return entities;
};

export const unmarshallEntityLayoutArray = (dataView: DataView, bufferFormat: WPKBufferFormatEntityLayout): object[] => {
  const { layout } = bufferFormat;
  const formatStride = shaderFuncs.toStrideArray(layout);
  const entityCount = Math.floor(dataView.byteLength / formatStride);
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
    entities.push(entity);
  }
  return entities;
};
