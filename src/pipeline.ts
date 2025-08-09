import { usageToString } from './buffer-factory';
import { findUserFormatEntityIndexes, WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatMapEntity, WPKBufferType, WPKBufferTypes, WPKContentType } from './buffer-formats';
import { bufferResourcesFactory, WPKBufferResources } from './buffer-resources';
import { cacheFactory, WPKEntityCache, WPKUniformCache } from './cache';
import { datumExtractorFactory } from './datum-extractor';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKComputePipelineDetail, WPKDrawCounts, WPKPipelineDetail, WPKRenderPipelineDetail, WPKShaderModuleDetail, WPKVertexBufferDetail } from './detail-types';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { logFactory } from './logging';
import { WPKMeshFactoryMap } from './mesh-factory';
import { meshFuncs } from './meshes';
import { pipelineResourceFactory } from './pipeline-resources';
import { pipelineFuncs } from './pipeline-utils';
import { resourceFactory, WPKResource } from './resources';
import { shaderFuncs, WPKBufferBinding, WPKComputeShader, WPKRenderShader, WPKShader } from './shaders';
import { arrayFuncs, changeDetectorFactory, logFuncs, recordFuncs } from './utils';

type WPKPipelineOptionsEntitiesFixedSize<TEntityFormat extends WPKInstanceFormat> = {
  initialEntities: WPKInstanceOf<TEntityFormat>[];
};
type WPKPipelineOptionsEntitiesResizeable = {
  resizeable: true;
};
type WPKPipelineOptionsEntities<TEntityFormat extends WPKInstanceFormat> =
  | WPKPipelineOptionsEntitiesFixedSize<TEntityFormat>
  | WPKPipelineOptionsEntitiesResizeable;
export type WPKPipelineOptions<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TMutableUniform extends boolean, TMutableEntities extends boolean> = {
  uniform: {
    format: TUniformFormat;
    initialUniform: WPKInstanceOf<TUniformFormat>;
    mutable: TMutableUniform;
  };
  entities: {
    format: TEntityFormat;
    mutable: TMutableEntities;
  }
  & WPKPipelineOptionsEntities<TEntityFormat>;
};

export type WPKPipelineDefinition<
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>,
  TMeshFactoryMap extends WPKMeshFactoryMap,
  TMutableUniform extends boolean,
  TMutableEntities extends boolean,
> = {
  name: string;
  bufferFormats: TBufferFormatMap;
  meshFactories: TMeshFactoryMap;
  shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>;
  options: WPKPipelineOptions<TUniformFormat, TEntityFormat, TMutableUniform, TMutableEntities>;
};

export type WPKPipeline<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean> =
  {
    name: string;
    pipelineDetail: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder, options: WPKPipelineDetailOptions) => WPKPipelineDetail;
  }
  & (TMutableUniform extends true
    ? {
      mutateUniform: (uniform: WPKInstanceOf<TUniformFormat>) => void
    }
    : object
  )
  & (TMutableEntities extends true
    ? TResizeableEntities extends true
    ? {
      mutateEntityById: (id: string, entity: WPKInstanceOf<TEntityFormat>) => void
    }
    : {
      mutateEntityByIndex: (index: number, entity: WPKInstanceOf<TEntityFormat>) => void
    }
    : object
  )
  & (TResizeableEntities extends true
    ? {
      add: (instance: WPKInstanceOf<TEntityFormat>) => string;
      remove: (instanceId: string) => void;
    }
    : object
  );

export type WPKPipelineDetailOptions = {
  isAntiAliased: boolean;
  textureFormat: GPUTextureFormat;
};

const LOGGER = logFactory.getLogger('pipeline');

const isEntitiesOptionsFixedSize = <TEntityFormat extends WPKInstanceFormat>(options: WPKPipelineOptionsEntities<TEntityFormat>): options is WPKPipelineOptionsEntitiesFixedSize<TEntityFormat> =>
  (options as WPKPipelineOptionsEntitiesFixedSize<TEntityFormat>).initialEntities !== undefined;
const isEntitiesOptionsResizeable = <TEntityFormat extends WPKInstanceFormat>(options: WPKPipelineOptionsEntities<TEntityFormat>): options is WPKPipelineOptionsEntitiesResizeable =>
  (options as WPKPipelineOptionsEntitiesResizeable).resizeable === true;

export const pipelineFactory = {
  toPipeline: <
    TUniformFormat extends WPKInstanceFormat,
    TEntityFormat extends WPKInstanceFormat,
    TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>,
    TMeshFactoryMap extends WPKMeshFactoryMap,
    TMutableUniform extends boolean,
    TMutableEntities extends boolean,
    TResizeableEntities extends boolean,
  >(
    definition: WPKPipelineDefinition<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap, TMutableUniform, TMutableEntities>
  ): WPKPipeline<TUniformFormat, TEntityFormat, TMutableUniform, TMutableEntities, TResizeableEntities> => {
    const { name, bufferFormats, options: { uniform, entities } } = definition;
    const uniformCache = cacheFactory.ofUniform(uniform.format, uniform.mutable, uniform.initialUniform);
    const entityCache = isEntitiesOptionsFixedSize(entities)
      ? cacheFactory.ofEntitiesFixedSize(entities.format, entities.mutable, ...entities.initialEntities)
      : cacheFactory.ofEntitiesResizeable(entities.format, entities.mutable, findUserFormatEntityIndexes(bufferFormats).map(userFormat => datumExtractorFactory.ofEntityId(userFormat)));
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
    if (uniform.mutable) {
      (pipeline as WPKPipeline<TUniformFormat, any, true, any, any>).mutateUniform = (uniform) => (uniformCache as WPKUniformCache<TUniformFormat, true>).mutate(uniform);
    }
    if (entities.mutable) {
      if (isEntitiesOptionsFixedSize(entities)) {
        (pipeline as WPKPipeline<any, TEntityFormat, any, true, false>).mutateEntityByIndex = (index, entity) => (entityCache as WPKEntityCache<TEntityFormat, true, false>).mutate(index, entity);
      } else if (isEntitiesOptionsResizeable(entities)) {
        (pipeline as WPKPipeline<any, TEntityFormat, any, true, true>).mutateEntityById = (id, entity) => (entityCache as WPKEntityCache<TEntityFormat, true, true>).mutate(id, entity);
      }
    }
    if (isEntitiesOptionsResizeable(entities)) {
      (pipeline as WPKPipeline<any, TEntityFormat, any, any, true>).add = (entity) => (entityCache as WPKEntityCache<TEntityFormat, any, true>).add(entity);
      (pipeline as WPKPipeline<any, TEntityFormat, any, any, true>).remove = (id) => (entityCache as WPKEntityCache<TEntityFormat, any, true>).remove(id);
    }
    return pipeline as WPKPipeline<TUniformFormat, TEntityFormat, TMutableUniform, TMutableEntities, TResizeableEntities>;
  },
};

const toBufferResources = (uniformCache: WPKUniformCache<any, any>, entityCache: WPKEntityCache<any, any, any>, definition: WPKPipelineDefinition<any, any, any, any, any, any>): WPKBufferResources<any, any, any> => {
  const { name } = definition;
  logFuncs.lazyTrace(LOGGER, () => `Create buffer resources for definition ${name}`);
  const { bufferFormats, shader } = definition;
  const bufferUsages = toBufferUsages(shader, bufferFormats);
  return bufferResourcesFactory.ofUniformAndInstances(name, uniformCache, entityCache, bufferFormats, bufferUsages);
};

const toBufferUsages = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormatMap, any>,
  bufferFormats: TBufferFormatMap,
): Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap>, GPUBufferUsageFlags> => {
  logFuncs.lazyDebug(LOGGER, () => `Calculate buffer usage from buffer formats ${JSON.stringify(Object.keys(bufferFormats))}`);
  return recordFuncs.mapRecord(bufferFormats, (bufferFormat, key) => {
    logFuncs.lazyTrace(LOGGER, () => `Calculate buffer usage from buffer format ${JSON.stringify(key)}`);
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
    logFuncs.lazyTrace(LOGGER, () => `Buffer ${key} has usage ${usageToString(usage)}`);
    if (usage === 0) {
      logFuncs.lazyWarn(LOGGER, () => `Buffer ${key} isn't used`);
    }
    return usage;
  }) as Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormatMap>, GPUBufferUsageFlags>;
};

const toPipelineDetailResource = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap>(
  definition: WPKPipelineDefinition<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap, any, any>,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
  bufferResources: WPKBufferResources<any, any, any>,
): WPKResource<WPKPipelineDetail> => {
  const { name, meshFactories, shader, bufferFormats } = definition;
  logFuncs.lazyDebug(LOGGER, () => `Create pipeline detail resource ${name}`);
  if (bufferResources === undefined) {
    throw Error('Error when creating pipeline, no buffer resources');
  }
  const computePipelineDetailsResource = shaderFuncs.isComputeShader(shader)
    ? toComputePipelineDetailsResource(name, shader, () => bufferResources.instanceCount(), bufferFormats, bufferResources)
    : undefined;
  const renderPipelineDetailResource = shaderFuncs.isRenderShader(shader)
    ? toRenderPipelineDetailsResource(name, meshFactories, shader, () => bufferResources.instanceCount(), bufferFormats, bufferResources, isAntiAliasedFunc, textureFormatFunc)
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

const toComputePipelineDetailsResource = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
  name: string,
  computeShader: WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormatMap>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormatMap,
  bufferResources: WPKBufferResources<any, any, any>,
): WPKResource<WPKComputePipelineDetail[]> | undefined => {
  logFuncs.lazyDebug(LOGGER, () => `Creating compute pipeline details resource ${name}`);
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
  logFuncs.lazyDebug(LOGGER, () => `Creating render pipeline details resource ${name}`);
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
  logFuncs.lazyDebug(LOGGER, () => 'Creating compute shader module detail');
  const { compute: { passes, shader } } = computeShader;
  return {
    code: shader,
    entryPoints: passes.map(c => c.entryPoint),
  };
};

const toRenderShaderModuleDetail = <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormatMap extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMeshFactoryMap extends WPKMeshFactoryMap>(
  renderShader: WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormatMap, TMeshFactoryMap>,
): WPKShaderModuleDetail => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating render shader module detail');
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
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind group layout entries');
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
  logFuncs.lazyDebug(LOGGER, () => 'Calculating buffer binding type');
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
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind group layouts resource');
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
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind groups detail resource');
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
  logFuncs.lazyDebug(LOGGER, () => 'Creating bind group entries resources');
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
  logFuncs.lazyDebug(LOGGER, () => 'Calculating max bind group');
  return bufferBindings.reduce((max, bufferBinding) => Math.max(max, bufferBinding.group), -1);
};
