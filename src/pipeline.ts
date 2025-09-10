import { bufferFactory, usageToString } from './buffer-factory';
import { bufferFormatFuncs } from './buffer-formats';
import { bufferResourcesFactory } from './buffer-resources';
import { cacheFactory } from './cache';
import { datumBridgeFactory } from './datum-bridge';
import { datumExtractEmbedFactory } from './datum-extract-embed';
import { logFactory } from './logging';
import { meshFuncs } from './mesh-factories';
import { pipelineResourceFactory } from './pipeline-resources';
import { pipelineFuncs } from './pipeline-utils';
import { resourceFactory } from './resources';
import { toCodeShaderCompute, toCodeShaderRender } from './shader-code';
import { DISPATCH_GROUP_BINDING, DISPATCH_PARAMS_BUFFER_NAME, MAX_GROUP_INDEX } from './shader-reserved';
import { shaderFuncs } from './shader-utils';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKDebugBufferContentMap, WPKBufferFormat, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatType, WPKBufferResizeable, WPKBufferResources, WPKComputePipelineDetail, WPKDebugFunc, WPKDebugOptions, WPKDrawCounts, WPKEntityCache, WPKGroupBinding, WPKGroupIndex, WPKHasBufferFormatType, WPKMeshTemplateMap, WPKPipeline, WPKPipelineDefinition, WPKPipelineDetail, WPKPipelineOptions, WPKRenderPipelineDetail, WPKResource, WPKShader, WPKShaderStageCompute, WPKShaderStageRender, WPKTrackedBuffer, WPKUniformCache, WPKVertexBufferDetail, WPKDispatchBuffer } from './types';
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
    debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap> = {},
  ): WPKPipeline<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities> => {
    if (Object.keys(definition.bufferFormats).includes(DISPATCH_PARAMS_BUFFER_NAME)) {
      throw Error(`Cannot use reserved buffer format name ${DISPATCH_PARAMS_BUFFER_NAME}`);
    }
    const { name, bufferFormats } = definition;
    const uniformCache = cacheFactory.ofUniform(options.mutableUniform, options.initialUniform);
    const entityCache = toEntityCache(options, bufferFormats);
    const isAntiAliasedChangeDetector = changeDetectorFactory.ofTripleEquals<boolean>(true);
    const textureFormatChangeDetector = changeDetectorFactory.ofTripleEquals<GPUTextureFormat>('rgba8unorm');
    const bufferResources = toBufferResources(uniformCache, entityCache, definition, debug);
    const dispatchBuffer = bufferResourcesFactory.ofDispatch(name, debug.onBufferContents !== undefined);
    const pipelineDetailResource = toPipelineDetailResource(definition, isAntiAliasedChangeDetector.get, textureFormatChangeDetector.get, bufferResources, dispatchBuffer, debug);
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
    const entityIndexDatumExtractors = entityIndexes.map(userFormat => datumExtractEmbedFactory.ofEntityId(userFormat.entityIdKey).extract);
    const entityCache = cacheFactory.ofEntitiesResizeable(options.mutableEntities, entityIndexDatumExtractors);
    options.initialEntities.forEach(entity => entityCache.add(entity));
    return entityCache;
  } else {
    return cacheFactory.ofEntitiesFixedSize(options.mutableEntities, ...options.initialEntities);
  }
};

const toBufferResources = (
  uniformCache: WPKUniformCache<any, any>,
  entityCache: WPKEntityCache<any, any, any>,
  definition: WPKPipelineDefinition<any, any, any, any>,
  debug: WPKDebugOptions<any, any, any>
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
  dispatchBuffer: WPKDispatchBuffer,
  debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap>,
): WPKResource<WPKPipelineDetail> => {
  const { name, meshFactories, shader, bufferFormats } = definition;
  logFuncs.lazyDebug(LOGGER, () => `Create pipeline detail resource ${name}`);
  if (bufferResources === undefined) {
    throw Error('Error when creating pipeline, no buffer resources');
  }
  const computePipelineDetailsResource = shader.compute !== undefined
    ? toComputePipelineDetailsResource(name, shader.compute, () => bufferResources.instanceCount(), bufferFormats, bufferResources, dispatchBuffer)
    : undefined;
  const renderPipelineDetailResource = shader.render !== undefined
    ? toRenderPipelineDetailsResource(name, meshFactories, shader.render, () => bufferResources.instanceCount(), bufferFormats, bufferResources, dispatchBuffer, isAntiAliasedFunc, textureFormatFunc, debug)
    : undefined;
  logFuncs.lazyDebug(LOGGER, () => `Pipeline ${name} has compute pipeline ${computePipelineDetailsResource !== undefined} has render pipeline ${renderPipelineDetailResource !== undefined}`);
  // const debugFuncResource = toDebugFuncResource(bufferFormats, bufferResources, debug);
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
        if (debug.onBufferContents !== undefined) {
          // pipelineDetail.debugFunc = debugFuncResource.get(device, queue, encoder);
        }
      }
      return pipelineDetail;
    },
  };
};

const toComputePipelineDetailsResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  name: string,
  computeShader: WPKShaderStageCompute<TUniform, TEntity, TBufferFormatMap>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  dispatchBuffer: WPKDispatchBuffer,
): WPKResource<WPKComputePipelineDetail[]> => {
  name = `${name}-compute`;
  logFuncs.lazyDebug(LOGGER, () => `Creating compute pipeline details resource ${name}`);
  const { groupBindings, passes } = computeShader;
  const visibility = GPUShaderStage.COMPUTE;
  logFuncs.lazyDebug(LOGGER, () => `Group bindings: ${JSON.stringify(groupBindings)}`);
  const groupBindingsWithDispatch = [...groupBindings, DISPATCH_GROUP_BINDING];
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, groupBindingsWithDispatch, bufferFormats);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const computeShaderModuleDetail = toCodeShaderCompute(computeShader, bufferFormats);
  const computeShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, computeShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, groupBindingsWithDispatch, bufferFormats, bufferResources, dispatchBuffer);
  const computePipelineDetailResources: WPKResource<WPKComputePipelineDetail>[] = [];
  for (const [index, computePass] of passes.entries()) {
    const { entryPoint, workGroupSize } = computePass;
    const computePipelineResource = pipelineResourceFactory.ofComputePipeline(name, index, pipelineLayoutResource, computeShaderModuleResource, entryPoint);
    const dispatchParamsFunc = () => pipelineFuncs.toDispatchParams(workGroupSize, instanceCountFunc());
    const dispatchSizeResource = pipelineResourceFactory.ofDispatchSize(dispatchParamsFunc, dispatchBuffer);
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
  dispatchBuffer: WPKDispatchBuffer,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
  debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap>,
): WPKResource<WPKRenderPipelineDetail[]> => {
  name = `${name}-render`;
  logFuncs.lazyDebug(LOGGER, () => `Creating render pipeline details resource ${name}`);
  const { groupBindings, passes } = renderShader;
  const visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, groupBindings, bufferFormats);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const renderShaderModuleDetail = toCodeShaderRender(renderShader, bufferFormats);
  const renderShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, renderShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, groupBindings, bufferFormats, bufferResources, dispatchBuffer);
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
    const meshBufferResource = bufferResourcesFactory.ofMesh(name, mesh, debug.onBufferContents !== undefined);
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

const toDebugFuncResource = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<TUniform, TEntity, TBufferFormatMap>,
  debug: WPKDebugOptions<TUniform, TEntity, TBufferFormatMap>
): WPKResource<WPKDebugFunc> => {
  const { onBufferContents } = debug;
  if (onBufferContents === undefined) {
    return {
      get(_device, _queue, _encoder) {
        return async () => { };
      },
    };
  }
  const debugTrackedBuffers = {} as Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>, WPKBufferResizeable & WPKResource<WPKTrackedBuffer>>;
  for (const [name] of Object.entries(bufferResources.buffers)) {
    const debugBufferResource = bufferFactory.ofResizeable(false, `${name}-debug`, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ, false);
    debugTrackedBuffers[name as WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>] = debugBufferResource;
  }
  return {
    get(device, queue, encoder) {
      const debugBuffers = {} as Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>, GPUBuffer>;
      for (const [bufferName, bufferResourceObj] of Object.entries(bufferResources.buffers)) {
        if (bufferName === DISPATCH_PARAMS_BUFFER_NAME) {
          continue;
        }
        const bufferResource = bufferResourceObj as WPKResource<WPKTrackedBuffer>;
        const sourceBuffer = bufferResource.get(device, queue, encoder);
        const copyBytesLength = sourceBuffer.bytesLength;
        const debugBufferResource = debugTrackedBuffers[bufferName as WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>];
        debugBufferResource.resize(copyBytesLength);
        const targetBuffer = debugBufferResource.get(device, queue, encoder);
        encoder.copyBufferToBuffer(sourceBuffer.buffer, 0, targetBuffer.buffer, 0, copyBytesLength);
        debugBuffers[bufferName as WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>] = targetBuffer.buffer;
      }
      const debugFunc: WPKDebugFunc = async (): Promise<void> => {
        const contentMap = {} as WPKDebugBufferContentMap<TUniform, TEntity, TBufferFormatMap>;
        const promises = Object.entries(debugBuffers)
          .map(([bufferName, bufferObj]) =>
            addContents(
              bufferName as WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>,
              bufferObj as GPUBuffer,
              bufferFormats[bufferName],
              contentMap));
        await Promise.all(promises);
        await onBufferContents(contentMap);
      };
      return debugFunc;
    },
  };
};

const addContents = async <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  bufferName: WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>,
  buffer: GPUBuffer,
  bufferFormat: WPKBufferFormat<TUniform, TEntity>,
  contentMap: WPKDebugBufferContentMap<TUniform, TEntity, TBufferFormatMap>
): Promise<void> => {
  await buffer.mapAsync(GPUMapMode.READ);
  const mappedRange = buffer.getMappedRange().slice(0);
  buffer.unmap();
  const dataView = new DataView(mappedRange);
  logFuncs.lazyDebug(LOGGER, () => `${bufferName} contents: ${new Float32Array(mappedRange)}`);
  const { bufferType } = bufferFormat;
  if (bufferType === 'uniform') {
    const { marshall } = bufferFormat;
    const uniform = {} as TUniform;
    let datumOffset = 0;
    for (const entry of marshall) {
      const bridge = datumBridgeFactory.ofFormatElement(entry, datumOffset);
      bridge.dataViewToInstance(0, uniform, dataView);
      datumOffset += bridge.stride;
    }
    contentMap[bufferName] = uniform as any;
  } else if (bufferType === 'marshalled') {
    const { marshall } = bufferFormat;
    const formatStride = shaderFuncs.toStrideArray(marshall);
    const entityCount = mappedRange.byteLength / formatStride;
    const entities: Partial<TEntity>[] = [];
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
    contentMap[bufferName] = entities as any;
  } else if (bufferType === 'editable') {
    const { layout } = bufferFormat;
    const formatStride = shaderFuncs.toStrideArray(layout);
    const entityCount = mappedRange.byteLength / formatStride;
    const entities: Partial<TEntity>[] = [];
    for (let i = 0; i < entityCount; i++) {
      const dataViewOffset = i * formatStride;
      const entity = {} as Partial<TEntity>;
      let datumOffset = 0;
      for (const entry of layout) {
        const bridge = datumBridgeFactory.ofStructEntry(entry, datumOffset);
        bridge.dataViewToInstance(dataViewOffset, entity, dataView);
        datumOffset += bridge.stride;
      }
      entities.push(entity);
    }
    contentMap[bufferName] = entities as any;
  }
};

const toBindGroupLayoutEntries = <
  TUniform,
  TEntity,
  TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
  TIncludeUniform extends boolean,
  TIncludeEntity extends boolean,
>(groupBindings: Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, TIncludeUniform, TIncludeEntity>>, group: WPKGroupIndex, visibility: GPUShaderStageFlags, bufferFormats: TBufferFormatMap,): GPUBindGroupLayoutEntry[] => {
  const entries = groupBindings.filter((groupBinding) => groupBinding.group === group)
    .map((groupBinding) => {
      const { binding, buffer } = groupBinding;
      const type = (buffer === DISPATCH_PARAMS_BUFFER_NAME)
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

const toBufferBindingType = <TBufferType extends WPKBufferFormatType>(visibility: GPUShaderStageFlags, bufferFormat: WPKHasBufferFormatType<TBufferType>): GPUBufferBindingType => {
  logFuncs.lazyDebug(LOGGER, () => `Calculating buffer binding type for buffer format ${JSON.stringify(bufferFormat)}`);
  const { bufferType } = bufferFormat;
  return bufferType === 'uniform'
    ? 'uniform'
    : (visibility === GPUShaderStage.COMPUTE) && (bufferType === 'editable')
      ? 'storage'
      : 'read-only-storage';
};

const toBindGroupLayoutsResource = <
  TUniform,
  TEntity,
  TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
  TIncludeUniform extends boolean,
  TIncludeEntity extends boolean,
>(name: string, visibility: GPUShaderStageFlags, groupBindings: Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, TIncludeUniform, TIncludeEntity>>, bufferFormats: TBufferFormatMap): WPKResource<GPUBindGroupLayout[]> => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind group layouts resource');
  const bindGroupLayoutResources: WPKResource<GPUBindGroupLayout>[] = [];
  for (let group = 0; group <= MAX_GROUP_INDEX; group++) {
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
  dispatchBuffer: WPKDispatchBuffer
): WPKResource<WPKBindGroupsDetail> => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind groups detail resource');
  const bindGroupDetailResources: WPKResource<WPKBindGroupDetail>[] = [];
  for (let group = 0; group <= MAX_GROUP_INDEX; group++) {
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
  dispatchBuffer: WPKDispatchBuffer
): WPKResource<GPUBindGroupEntry>[] => {
  logFuncs.lazyDebug(LOGGER, () => `Creating bind group entries resources for group ${group}`);
  return groupBindings.filter(groupBinding => groupBinding.group === group)
    .map((groupBinding) => {
      const { binding, buffer } = groupBinding;
      const bufferResource = (buffer === DISPATCH_PARAMS_BUFFER_NAME)
        ? dispatchBuffer
        : bufferResources.buffers[buffer as WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>];
      return pipelineResourceFactory.ofBindGroupEntry(binding, bufferResource);
    });
};
