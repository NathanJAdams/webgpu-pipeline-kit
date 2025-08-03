import { WPKTrackedBuffer } from './buffer-factory';
import { WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatMapEntity, WPKBufferType, WPKBufferTypes, WPKContentType } from './buffer-formats';
import { bufferResourcesFactory, WPKBufferResources } from './buffer-resources';
import { WPKEntityCache, WPKUniformCache } from './cache';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKComputePipelineDetail, WPKDrawCounts, WPKPipelineDetail, WPKRenderPipelineDetail, WPKShaderModuleDetail, WPKVertexBufferDetail } from './detail-types';
import { WPKInstanceFormat } from './instance';
import { meshFuncs } from './mesh';
import { pipelineResourceFactory } from './pipeline-resources';
import { pipelineFuncs } from './pipeline-utils';
import { resourceFactory, WPKResource } from './resources';
import { WPKBufferBinding, WPKComputeShader, shaderFuncs, WPKRenderShader, WPKShader } from './shaders';
import { arrayFuncs, changeDetectorFactory, Color, recordFuncs } from './utils';

export type WPKPipeline = {
  pipelineDetail: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder, options: WPKPipelineDetailOptions) => WPKPipelineDetail;
};

export type WPKPipelineOptions = {
  clear: Color;
  isAntiAliased: boolean;
};
export type WPKPipelineDetailOptions = {
  isAntiAliased: boolean;
  textureFormat: GPUTextureFormat;
};

export const pipelineFactory = {
  of: <
    TUniformFormat extends WPKInstanceFormat,
    TEntityFormat extends WPKInstanceFormat,
    TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
      name: string,
      bufferFormats: TBufferFormats,
      shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormats>,
      uniformCache: WPKUniformCache<TUniformFormat, any>,
      entityCache: WPKEntityCache<TEntityFormat, any, any>,
    ): WPKPipeline => {
    const bufferUsages = toBufferUsages(shader, bufferFormats);
    const bufferResources = bufferResourcesFactory.ofUniformAndInstances(name, uniformCache, entityCache, bufferFormats, bufferUsages);
    const isAntiAliasedChangeDetector = changeDetectorFactory.ofTripleEquals<boolean>(true);
    const textureFormatChangeDetector = changeDetectorFactory.ofTripleEquals<GPUTextureFormat>('rgba8unorm');
    const pipelineDetailResource = toPipelineDetailResource(
      name,
      isAntiAliasedChangeDetector.get,
      textureFormatChangeDetector.get,
      shader,
      bufferFormats,
      bufferResources,
    );
    return {
      pipelineDetail(device, queue, encoder, options) {
        const { isAntiAliased, textureFormat } = options;
        isAntiAliasedChangeDetector.compareAndUpdate(isAntiAliased);
        textureFormatChangeDetector.compareAndUpdate(textureFormat);
        return pipelineDetailResource.get(device, queue, encoder);
      },
    };
  },
};

const toComputeShaderModuleDetail = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    computeShader: WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormats>,
  ): WPKShaderModuleDetail => {
  const { compute: { passes, shader } } = computeShader;
  return {
    code: shader,
    entryPoints: passes.map(c => c.entryPoint),
  };
};

const toRenderShaderModuleDetail = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    renderShader: WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormats>,
  ): WPKShaderModuleDetail => {
  const { render: { passes, shader } } = renderShader;
  return {
    code: shader,
    entryPoints: arrayFuncs.merge(passes.map(r => r.vertex.entryPoint), passes.map(r => r.fragment.entryPoint)),
  };
};

const toBufferUsages = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormats>,
    bufferFormats: TBufferFormats,
  ): Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, GPUBufferUsageFlags> => {
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
  }) as Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, GPUBufferUsageFlags>;
};

const toMaxBindGroup = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormats>[]): number => {
  return bufferBindings.reduce((max, bufferBinding) => Math.max(max, bufferBinding.group), -1);
};

const toBufferBindingType = <TBufferType extends WPKBufferType, TContentType extends WPKContentType>(visibility: GPUShaderStageFlags, bufferFormat: WPKBufferTypes<TBufferType, TContentType>): GPUBufferBindingType => {
  return bufferFormat.bufferType === 'uniform'
    ? 'uniform'
    : (visibility === GPUShaderStage.COMPUTE) && (bufferFormat.contentType === 'layout')
      ? 'storage'
      : 'read-only-storage';
};

const toBindGroupLayoutEntries = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    visibility: GPUShaderStageFlags,
    bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormats>[],
    bufferFormats: TBufferFormats,
    group: number,
  ): GPUBindGroupLayoutEntry[] => {
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

const toBindGroupLayoutsResource = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    name: string,
    visibility: GPUShaderStageFlags,
    bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormats>[],
    bufferFormats: TBufferFormats
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

const toBindGroupEntriesResources = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormats>[],
    bufferResources: Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, WPKResource<WPKTrackedBuffer>>,
    group: number
  ): WPKResource<GPUBindGroupEntry>[] => {
  return bufferBindings
    .filter((bufferBinding) => bufferBinding.group === group)
    .map((bufferBinding) => {
      const { binding, buffer } = bufferBinding;
      const bufferResource = bufferResources[buffer];
      return pipelineResourceFactory.ofBindGroupEntry(binding, bufferResource);
    });
};

const toBindGroupsDetailResource = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    name: string,
    visibility: GPUShaderStageFlags,
    bufferBindings: WPKBufferBinding<TUniformFormat, TEntityFormat, TBufferFormats>[],
    bufferFormats: TBufferFormats,
    bufferResources: Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, WPKResource<WPKTrackedBuffer>>,
  ): WPKResource<WPKBindGroupsDetail> => {
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

const toComputePipelineDetailsResource = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    name: string,
    computeShader: WPKComputeShader<TUniformFormat, TEntityFormat, TBufferFormats>,
    instanceCountFunc: () => number,
    bufferFormats: TBufferFormats,
    bufferResources: Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, WPKResource<WPKTrackedBuffer>>,
  ): WPKResource<WPKComputePipelineDetail[]> | undefined => {
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

const toRenderPipelineDetailsResource = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    name: string,
    renderShader: WPKRenderShader<TUniformFormat, TEntityFormat, TBufferFormats>,
    instanceCountFunc: () => number,
    bufferFormats: TBufferFormats,
    bufferResources: Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, WPKResource<WPKTrackedBuffer>>,
    isAntiAliasedFunc: () => boolean,
    textureFormatFunc: () => GPUTextureFormat,
  ): WPKResource<WPKRenderPipelineDetail[]> | undefined => {
  const { render: { bufferBindings, mesh, passes } } = renderShader;
  const visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, bufferBindings, bufferFormats);
  const pipelineLayoutResource = pipelineResourceFactory.ofPipelineLayout(name, bindGroupLayoutsResource);
  const renderShaderModuleDetail = toRenderShaderModuleDetail(renderShader);
  const renderShaderModuleResource = pipelineResourceFactory.ofShaderModule(name, renderShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, bufferBindings, bufferFormats, bufferResources);
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
  const instanceBuffers = recordFuncs.filter(bufferResources, (_, key) => instanceBufferFormats[key as string] !== undefined);
  const renderPipelineDetailResources: WPKResource<WPKRenderPipelineDetail>[] = [];
  for (const [index, renderPass] of passes.entries()) {
    const { fragment, vertex } = renderPass;
    const meshBufferLocation = vertex.bufferLocations.find(bl => bl.type === 'mesh');
    const userDefinedVertexBufferDetailResources = vertex.bufferLocations
      .filter(bl => bl.type === 'user-defined')
      .map(bl => pipelineResourceFactory.ofBindingVertexBufferDetail(bl, instanceBufferFormats, instanceBuffers));
    const vertexBufferDetailResources: WPKResource<WPKVertexBufferDetail>[] = [];
    if (meshBufferLocation !== undefined) {
      vertexBufferDetailResources.push(pipelineResourceFactory.ofMeshVertexBufferDetail(meshBufferLocation, meshBufferResource));
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

const toPipelineDetailResource = <
  TUniformFormat extends WPKInstanceFormat,
  TEntityFormat extends WPKInstanceFormat,
  TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>>(
    name: string,
    isAntiAliasedFunc: () => boolean,
    textureFormatFunc: () => GPUTextureFormat,
    shader: WPKShader<TUniformFormat, TEntityFormat, TBufferFormats>,
    bufferFormats: TBufferFormats,
    WPKBufferResources: WPKBufferResources<TUniformFormat, TEntityFormat, TBufferFormats>,
  ): WPKResource<WPKPipelineDetail> => {
  const buffersResources = WPKBufferResources.buffers;
  const computePipelineDetailsResource = shaderFuncs.isComputeShader(shader)
    ? toComputePipelineDetailsResource(name, shader, () => WPKBufferResources.instanceCount, bufferFormats, buffersResources)
    : undefined;
  const renderPipelineDetailResource = shaderFuncs.isRenderShader(shader)
    ? toRenderPipelineDetailsResource(name, shader, () => WPKBufferResources.instanceCount, bufferFormats, buffersResources, isAntiAliasedFunc, textureFormatFunc)
    : undefined;
  return {
    get(device, queue, encoder) {
      WPKBufferResources.update();
      const isValid = WPKBufferResources.instanceCount > 0;
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
