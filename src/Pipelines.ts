import { WGBKBufferFormatKey, WGBKBufferFormats, WGBKBufferResources, WGBKEntityBufferFormats, WGBKMutableOptions, WGBKMutateById, WGBKMutateByIndex, WGBKMutateUniform, WGBKResizeInstances, WGBKResource, WGBKTrackedBuffer } from './buffer-resource-types';
import { BufferResources } from './buffer-resources';
import { WGBKInstanceFormat, WGBKInstanceOf } from './instance';
import { BufferBinding, ComputeShader, isComputeShader, isRenderShader, RenderShader, Shader } from './Shaders';
import { BindGroupDetail, BindGroupsDetail, ComputePipelineDetail, DrawCounts, PipelineDetail, RenderPipelineDetail, ShaderModuleDetail, VertexBufferDetail } from './types';
import { PipelineResources } from './pipeline-resources';
import { Resources } from './resources';
import { ArrayFuncs, ChangeDetectors, Color, PipelineUtils, RecordFuncs, WGBKMeshes } from './utils';

type PipelineBase = {
    pipelineDetail: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder, options: PipelineDetailOptions) => PipelineDetail;
};

export type Pipeline<
    TUniformFormat extends WGBKInstanceFormat,
    TEntityFormat extends WGBKInstanceFormat,
    TMutableUniform extends boolean,
    TMutableInstances extends boolean,
    TResizeableInstances extends boolean,
> = PipelineBase
    & (TMutableUniform extends true
        ? WGBKMutateUniform<TUniformFormat>
        : object)
    & (TMutableInstances extends true
        ? TResizeableInstances extends true
        ? WGBKMutateById<TEntityFormat>
        : WGBKMutateByIndex<TEntityFormat>
        : object
    )
    & (TResizeableInstances extends true
        ? WGBKResizeInstances<TEntityFormat>
        : object
    );

export type PipelineOptions = {
    clear: Color;
    isAntiAliased: boolean;
};
export type PipelineDetailOptions = {
    isAntiAliased: boolean;
    textureFormat: GPUTextureFormat;
};

export const PipelineFuncs = {
  of: (<
        TUniformFormat extends WGBKInstanceFormat,
        TEntityFormat extends WGBKInstanceFormat,
        TBufferFormats extends WGBKBufferFormats<TUniformFormat, TEntityFormat>,
        TMutableUniform extends boolean,
        TMutableInstances extends boolean,
        TResizeableInstances extends boolean,
    >(
      name: string,
      uniformFormat: TUniformFormat,
      entityFormat: TEntityFormat,
      bufferFormats: TBufferFormats,
      shader: Shader<TBufferFormats>,
      initialUniform: WGBKInstanceOf<TUniformFormat>,
      initialInstances: WGBKInstanceOf<TEntityFormat>[],
      options: WGBKMutableOptions<TMutableUniform, TMutableInstances, TResizeableInstances>,
    ): Pipeline<
        TUniformFormat,
        TEntityFormat,
        TMutableUniform,
        TMutableInstances,
        TResizeableInstances
    > => {
    const { isMutableUniform, isMutableInstances, isResizeableInstances } = options;
    const bufferUsages = toBufferUsages(shader, bufferFormats);
    const bufferResources = BufferResources.ofUniformAndInstances(name, initialUniform, initialInstances, bufferFormats, bufferUsages, options);
    const isAntiAliasedChangeDetector = ChangeDetectors.ofTripleEquals<boolean>(true);
    const textureFormatChangeDetector = ChangeDetectors.ofTripleEquals<GPUTextureFormat>('rgba8unorm');
    const pipelineDetailResource = toPipelineDetailResource<TBufferFormats>(
      name,
      isAntiAliasedChangeDetector.get,
      textureFormatChangeDetector.get,
      shader,
      bufferFormats,
      bufferResources,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: Pipeline<any, any, false, false, false> = {
      pipelineDetail(device, queue, encoder, options) {
        const { isAntiAliased, textureFormat } = options;
        isAntiAliasedChangeDetector.compareAndUpdate(isAntiAliased);
        textureFormatChangeDetector.compareAndUpdate(textureFormat);
        return pipelineDetailResource.get(device, queue, encoder);
      },
    };
    if (isMutableUniform) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pipeline as Pipeline<TUniformFormat, any, true, any, any>).mutateUniform = (bufferResources as WGBKBufferResources<TUniformFormat, any, any, true, any, any>).mutateUniform;
    }
    if (isMutableInstances) {
      if (isResizeableInstances) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pipeline as Pipeline<any, TEntityFormat, any, true, true>).mutateInstanceById = (bufferResources as WGBKBufferResources<any, TEntityFormat, any, any, true, true>).mutateInstanceById;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pipeline as Pipeline<any, TEntityFormat, any, true, false>).mutateInstanceByIndex = (bufferResources as WGBKBufferResources<any, TEntityFormat, any, any, true, false>).mutateInstanceByIndex;
      }
    }
    if (isResizeableInstances) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resizeablePipeline = pipeline as Pipeline<any, TEntityFormat, any, any, true>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resizeableInstanceBufferResources = bufferResources as WGBKBufferResources<any, TEntityFormat, any, any, any, true>;
      resizeablePipeline.add = resizeableInstanceBufferResources.add;
      resizeablePipeline.remove = resizeableInstanceBufferResources.remove;
    }
    return pipeline as Pipeline<TUniformFormat, TEntityFormat, TMutableUniform, TMutableInstances, TResizeableInstances>;
  }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toComputeShaderModuleDetail = <TBufferFormats extends WGBKBufferFormats<any, any>>(
  computeShader: ComputeShader<TBufferFormats>,
): ShaderModuleDetail => {
  const { compute: { passes, shader } } = computeShader;
  return {
    code: shader,
    entryPoints: passes.map(c => c.entryPoint),
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRenderShaderModuleDetail = <TBufferFormats extends WGBKBufferFormats<any, any>>(
  renderShader: RenderShader<TBufferFormats>,
): ShaderModuleDetail => {
  const { render: { passes, shader } } = renderShader;
  return {
    code: shader,
    entryPoints: ArrayFuncs.merge(passes.map(r => r.vertex.entryPoint), passes.map(r => r.fragment.entryPoint)),
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toBufferUsages = <TBufferFormats extends WGBKBufferFormats<any, any>>(
  shader: Shader<TBufferFormats>,
  bufferFormats: TBufferFormats,
): Record<WGBKBufferFormatKey<TBufferFormats>, GPUBufferUsageFlags> => {
  return RecordFuncs.mapRecord(bufferFormats, (bufferFormat, key) => {
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
  }) as Record<WGBKBufferFormatKey<TBufferFormats>, GPUBufferUsageFlags>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toMaxBindGroup = <TBufferFormats extends WGBKBufferFormats<any, any>>(bufferBindings: BufferBinding<TBufferFormats>[]): number => {
  return bufferBindings.reduce((max, bufferBinding) => Math.max(max, bufferBinding.group), -1);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toBindGroupLayoutEntries = <TBufferFormats extends WGBKBufferFormats<any, any>>(
  visibility: GPUShaderStageFlags,
  bufferBindings: BufferBinding<TBufferFormats>[],
  bufferFormats: TBufferFormats,
  group: number,
): GPUBindGroupLayoutEntry[] => {
  return bufferBindings
    .filter((bufferBinding) => bufferBinding.group === group)
    .map((bufferBinding) => {
      const { binding, buffer } = bufferBinding;
      const bufferFormat = bufferFormats[buffer];
      const type = BufferResources.toBufferBindingType(visibility, bufferFormat);
      return {
        binding,
        visibility,
        buffer: {
          type
        },
      };
    });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toBindGroupLayoutsResource = <TBufferFormats extends WGBKBufferFormats<any, any>>(
  name: string,
  visibility: GPUShaderStageFlags,
  bufferBindings: BufferBinding<TBufferFormats>[],
  bufferFormats: TBufferFormats
): WGBKResource<GPUBindGroupLayout[]> => {
  const maxBindGroup = toMaxBindGroup(bufferBindings);
  const bindGroupLayoutResources: WGBKResource<GPUBindGroupLayout>[] = [];
  for (let group = 0; group <= maxBindGroup; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(visibility, bufferBindings, bufferFormats, group);
    const bindGroupLayoutResource = PipelineResources.ofBindGroupLayout(groupName, bindGroupLayoutEntries);
    bindGroupLayoutResources.push(bindGroupLayoutResource);
  }
  return Resources.ofArray(bindGroupLayoutResources);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toBindGroupEntriesResources = <TBufferFormats extends WGBKBufferFormats<any, any>>(
  bufferBindings: BufferBinding<TBufferFormats>[],
  bufferResources: Record<WGBKBufferFormatKey<TBufferFormats>, WGBKResource<WGBKTrackedBuffer>>,
  group: number
): WGBKResource<GPUBindGroupEntry>[] => {
  return bufferBindings
    .filter((bufferBinding) => bufferBinding.group === group)
    .map((bufferBinding) => {
      const { binding, buffer } = bufferBinding;
      const bufferResource = bufferResources[buffer];
      return PipelineResources.ofBindGroupEntry(binding, bufferResource);
    });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toBindGroupsDetailResource = <TBufferFormats extends WGBKBufferFormats<any, any>>(
  name: string,
  visibility: GPUShaderStageFlags,
  bufferBindings: BufferBinding<TBufferFormats>[],
  bufferFormats: TBufferFormats,
  bufferResources: Record<WGBKBufferFormatKey<TBufferFormats>, WGBKResource<WGBKTrackedBuffer>>,
): WGBKResource<BindGroupsDetail> => {
  const maxBindGroup = toMaxBindGroup(bufferBindings);
  const bindGroupDetailResources: WGBKResource<BindGroupDetail>[] = [];
  for (let group = 0; group <= maxBindGroup; group++) {
    const groupName = `${name}-group-${group}`;
    const bindGroupLayoutEntries = toBindGroupLayoutEntries(visibility, bufferBindings, bufferFormats, group);
    const bindGroupLayoutResource = PipelineResources.ofBindGroupLayout(groupName, bindGroupLayoutEntries);
    const bindGroupEntriesResources = toBindGroupEntriesResources(bufferBindings, bufferResources, group);
    const bindGroupEntriesResource = Resources.ofArray(bindGroupEntriesResources);
    const bindGroupResource = PipelineResources.ofBindGroup(groupName, group, bindGroupLayoutResource, bindGroupEntriesResource);
    const bindGroupDetailResource = PipelineResources.ofBindGroupDetail(group, bindGroupResource);
    bindGroupDetailResources.push(bindGroupDetailResource);
  }
  return Resources.ofArray(bindGroupDetailResources);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toComputePipelineDetailsResource = <TBufferFormats extends WGBKBufferFormats<any, any>>(
  name: string,
  computeShader: ComputeShader<TBufferFormats>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormats,
  bufferResources: Record<WGBKBufferFormatKey<TBufferFormats>, WGBKResource<WGBKTrackedBuffer>>,
): WGBKResource<ComputePipelineDetail[]> | undefined => {
  const { compute: { bufferBindings, passes } } = computeShader;
  const visibility = GPUShaderStage.COMPUTE;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, bufferBindings, bufferFormats);
  const pipelineLayoutResource = PipelineResources.ofPipelineLayout(name, bindGroupLayoutsResource);
  const computeShaderModuleDetail = toComputeShaderModuleDetail(computeShader);
  const computeShaderModuleResource = PipelineResources.ofShaderModule(name, computeShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, bufferBindings, bufferFormats, bufferResources);
  const computePipelineDetailResources: WGBKResource<ComputePipelineDetail>[] = [];
  for (const [index, computePass] of passes.entries()) {
    const { entryPoint, workGroupSize } = computePass;
    const computePipelineResource = PipelineResources.ofComputePipeline(name, index, pipelineLayoutResource, computeShaderModuleResource, entryPoint);
    const workGroupSizeFunc = () => PipelineUtils.toWorkGroupSize(workGroupSize, instanceCountFunc());
    const computeDetailResource = PipelineResources.ofComputeDetail(bindGroupsDetailResource, computePipelineResource, workGroupSizeFunc);
    computePipelineDetailResources.push(computeDetailResource);
  }
  return Resources.ofArray(computePipelineDetailResources);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRenderPipelineDetailsResource = <TBufferFormats extends WGBKBufferFormats<any, any>>(
  name: string,
  renderShader: RenderShader<TBufferFormats>,
  instanceCountFunc: () => number,
  bufferFormats: TBufferFormats,
  bufferResources: Record<WGBKBufferFormatKey<TBufferFormats>, WGBKResource<WGBKTrackedBuffer>>,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
): WGBKResource<RenderPipelineDetail[]> | undefined => {
  const { render: { bufferBindings, mesh, passes } } = renderShader;
  const visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const bindGroupLayoutsResource = toBindGroupLayoutsResource(name, visibility, bufferBindings, bufferFormats);
  const pipelineLayoutResource = PipelineResources.ofPipelineLayout(name, bindGroupLayoutsResource);
  const renderShaderModuleDetail = toRenderShaderModuleDetail(renderShader);
  const renderShaderModuleResource = PipelineResources.ofShaderModule(name, renderShaderModuleDetail, pipelineLayoutResource);
  const bindGroupsDetailResource = toBindGroupsDetailResource(name, visibility, bufferBindings, bufferFormats, bufferResources);
  const indicesCount = WGBKMeshes.indicesCount(mesh);
  const indicesType = WGBKMeshes.indicesType(mesh);
  const drawCountsFunc = (): DrawCounts => ({
    indexCount: indicesCount,
    instanceCount: instanceCountFunc(),
  });
  const meshBufferResource = BufferResources.ofMesh(name, mesh);
  const indicesBufferResource: WGBKResource<GPUBuffer> = {
    get(device, queue, encoder) {
      return meshBufferResource.indices.get(device, queue, encoder).buffer;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instanceBufferFormats = RecordFuncs.filter(bufferFormats, (bufferFormat) => bufferFormat.bufferType === 'entity') as WGBKEntityBufferFormats<any>;
  const instanceBuffers = RecordFuncs.filter(bufferResources, (_, key) => instanceBufferFormats[key as string] !== undefined);
  const renderPipelineDetailResources: WGBKResource<RenderPipelineDetail>[] = [];
  for (const [index, renderPass] of passes.entries()) {
    const { fragment, vertex } = renderPass;
    const meshBufferLocation = vertex.bufferLocations.find(bl => bl.type === 'mesh');
    const userDefinedVertexBufferDetailResources = vertex.bufferLocations
      .filter(bl => bl.type === 'user-defined')
      .map(bl => PipelineResources.ofBindingVertexBufferDetail(bl, instanceBufferFormats, instanceBuffers));
    const vertexBufferDetailResources: WGBKResource<VertexBufferDetail>[] = [];
    if (meshBufferLocation !== undefined) {
      vertexBufferDetailResources.push(PipelineResources.ofMeshVertexBufferDetail(meshBufferLocation, meshBufferResource));
    }
    vertexBufferDetailResources.push(...userDefinedVertexBufferDetailResources);
    const vertexBufferDetailsResource = Resources.ofArray(vertexBufferDetailResources);
    const vertexBufferLayoutsResource = PipelineResources.ofVertexBufferLayouts(vertexBufferDetailsResource);
    const vertexBuffersResource = PipelineResources.ofVertexBuffers(vertexBufferDetailResources);
    const pipelineResource = PipelineResources.ofRenderPipeline(name, index, mesh, renderShaderModuleResource, vertex.entryPoint, fragment.entryPoint, vertexBufferLayoutsResource, pipelineLayoutResource, isAntiAliasedFunc, textureFormatFunc);
    const renderPipelineDetailResource = PipelineResources.ofRenderPipelineDetail(indicesType, bindGroupsDetailResource, indicesBufferResource, vertexBuffersResource, pipelineResource, drawCountsFunc);
    renderPipelineDetailResources.push(renderPipelineDetailResource);
  }
  return Resources.ofArray(renderPipelineDetailResources);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toPipelineDetailResource = <TBufferFormats extends WGBKBufferFormats<any, any>>(
  name: string,
  isAntiAliasedFunc: () => boolean,
  textureFormatFunc: () => GPUTextureFormat,
  shader: Shader<TBufferFormats>,
  bufferFormats: TBufferFormats,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wgbkBufferResources: WGBKBufferResources<any, any, TBufferFormats, boolean, boolean, boolean>,
): WGBKResource<PipelineDetail> => {
  const buffersResources = wgbkBufferResources.buffers;
  const computePipelineDetailsResource = isComputeShader(shader)
    ? toComputePipelineDetailsResource(name, shader, wgbkBufferResources.instanceCount, bufferFormats, buffersResources)
    : undefined;
  const renderPipelineDetailResource = isRenderShader(shader)
    ? toRenderPipelineDetailsResource(name, shader, wgbkBufferResources.instanceCount, bufferFormats, buffersResources, isAntiAliasedFunc, textureFormatFunc)
    : undefined;
  return {
    get(device, queue, encoder) {
      wgbkBufferResources.update();
      const isValid = wgbkBufferResources.instanceCount() > 0;
      const pipelineDetail: PipelineDetail = {
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
