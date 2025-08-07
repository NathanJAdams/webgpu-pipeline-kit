import { WPKTrackedBuffer } from './buffer-factory';
import { WPKBufferFormatKey, WPKBufferFormatMapEntity, WPKLayout, WPKUserFormat } from './buffer-formats';
import { WPKMeshBufferResource } from './buffer-resources';
import { WPKBindGroupDetail, WPKBindGroupsDetail, WPKComputePipelineDetail, WPKDrawCounts, WPKRenderPipelineDetail, WPKShaderModuleDetail, WPKVertexBufferDetail } from './detail-types';
import { WPKInstanceFormat } from './instance';
import { getLogger, lazyDebug, lazyTrace } from './logging';
import { meshFuncs, WPKMesh } from './meshes';
import { pipelineFuncs, WPKWorkGroupSize } from './pipeline-utils';
import { resourceFactory, WPKResource } from './resources';
import { WPKBufferLocationMesh, WPKBufferLocationUserDefined } from './shaders';
import { strideFuncs } from './strides';
import { NonEmptyArray } from './utils';

const LOGGER = getLogger('pipeline');

export const pipelineResourceFactory = {
  // layouts
  ofBindGroupLayout: (
    name: string,
    entries: GPUBindGroupLayoutEntry[]
  ): WPKResource<GPUBindGroupLayout> => {
    const label = `${name}-bind-group-layout`;
    lazyDebug(LOGGER, () => `Creating bind group layout resource ${label}`);
    return resourceFactory.ofCached({
      get(device, _queue, _encoder) {
        lazyTrace(LOGGER, () => `Creating bind group layout ${label}`);
        return device.createBindGroupLayout({
          label,
          entries,
        });
      },
    });
  },
  ofPipelineLayout: (
    name: string,
    bindGroupLayoutsResource: WPKResource<GPUBindGroupLayout[]>
  ): WPKResource<GPUPipelineLayout> => {
    const label = `${name}-pipeline-layout`;
    lazyDebug(LOGGER, () => `Creating pipeline layout resource ${label}`);
    return resourceFactory.ofCached({
      get(device, queue, encoder) {
        const bindGroupLayouts = bindGroupLayoutsResource.get(device, queue, encoder);
        lazyTrace(LOGGER, () => `Creating pipeline layout ${label}`);
        return device.createPipelineLayout({
          label,
          bindGroupLayouts,
        });
      },
    });
  },

  // shader
  ofShaderModule: (
    name: string,
    shaderModule: WPKShaderModuleDetail,
    pipelineLayoutResource: WPKResource<GPUPipelineLayout>
  ): WPKResource<GPUShaderModule> => {
    const label = `${name}-shader`;
    lazyDebug(LOGGER, () => `Creating shader module resource ${label}`);
    const { code, entryPoints } = shaderModule;
    return resourceFactory.ofCachedFromDependencies(
      [pipelineLayoutResource],
      (device, queue, encoder, values) => {
        lazyTrace(LOGGER, () => `Creating shader module ${label}`);
        return device.createShaderModule({
          label,
          code,
          compilationHints: entryPoints.map((entryPoint) => ({
            entryPoint,
            layout: values[0],
          })),
        });
      },
    );
  },

  // bind groups
  ofBindGroupEntry: (
    binding: number,
    bufferResource: WPKResource<WPKTrackedBuffer>
  ): WPKResource<GPUBindGroupEntry> => {
    lazyDebug(LOGGER, () => `Creating bind group entry resource binding ${binding}`);
    return resourceFactory.ofCachedFromDependencies(
      [bufferResource] as const,
      (device, queue, encoder, values) => {
        lazyTrace(LOGGER, () => `Creating bind group entry binding ${binding}`);
        return {
          binding,
          resource: {
            buffer: values[0].buffer,
          },
        };
      },
    );
  },
  ofBindGroup: (
    name: string,
    group: number,
    bindGroupLayoutResource: WPKResource<GPUBindGroupLayout>,
    bindGroupEntriesResource: WPKResource<GPUBindGroupEntry[]>
  ): WPKResource<GPUBindGroup> => {
    const label = `${name}-bind-group-${group}`;
    lazyDebug(LOGGER, () => `Creating bind group resource ${label}`);
    return resourceFactory.ofCachedFromDependencies(
      [bindGroupLayoutResource, bindGroupEntriesResource] as const,
      (device, queue, encoder, values) => {
        lazyTrace(LOGGER, () => `Creating bind group ${label}`);
        return device.createBindGroup({
          label,
          layout: values[0],
          entries: values[1],
        });
      },
    );
  },
  ofBindGroupDetail: (
    index: number,
    bindGroupResource: WPKResource<GPUBindGroup>,
  ): WPKResource<WPKBindGroupDetail> => {
    lazyDebug(LOGGER, () => `Creating bind group detail resource index ${index}`);
    return resourceFactory.ofCachedFromDependencies(
      [bindGroupResource],
      (device, queue, encoder, values) => {
        lazyTrace(LOGGER, () => `Creating bind group detail index ${index}`);
        return {
          group: values[0],
          index,
        };
      },
    );
  },

  // compute
  ofComputePipeline: (
    name: string,
    index: number,
    pipelineLayoutResource: WPKResource<GPUPipelineLayout>,
    shaderResource: WPKResource<GPUShaderModule>,
    entryPoint: string
  ): WPKResource<GPUComputePipeline> => {
    const label = `${name}-compute-pipeline-${index}`;
    lazyDebug(LOGGER, () => `Creating compute pipeline resource ${label}`);
    return resourceFactory.ofCachedFromDependencies(
      [pipelineLayoutResource, shaderResource] as const,
      (device, queue, encoder, values) => {
        lazyTrace(LOGGER, () => `Creating compute pipeline ${label}`);
        return device.createComputePipeline({
          label,
          layout: values[0],
          compute: {
            module: values[1],
            entryPoint,
          },
        });
      },
    );
  },
  ofComputeDetail: (
    bindGroupsResource: WPKResource<WPKBindGroupsDetail>,
    computePipelineResource: WPKResource<GPUComputePipeline>,
    workGroupSizeFunc: () => WPKWorkGroupSize
  ): WPKResource<WPKComputePipelineDetail> => {
    lazyDebug(LOGGER, () => 'Creating compute detail resource');
    return resourceFactory.ofCachedFromDependencies(
      [bindGroupsResource, computePipelineResource] as const,
      (device, queue, encoder, values) => {
        lazyTrace(LOGGER, () => 'Creating compute detail');
        return {
          bindGroups: values[0],
          pipeline: values[1],
          workGroupSizeFunc,
        };
      },
    );
  },

  // render
  ofVertexBufferDetailMesh: (
    meshBufferLocation: WPKBufferLocationMesh,
    meshBufferResource: WPKMeshBufferResource
  ): WPKResource<WPKVertexBufferDetail> => {
    lazyDebug(LOGGER, () => 'Creating vertex buffer detail resource from mesh');
    const { format, location, step } = meshBufferLocation;
    const arrayStride = pipelineFuncs.toByteLength(format);
    const attributes: GPUVertexAttribute[] = [{
      format,
      offset: 0,
      shaderLocation: location,
    }];
    return pipelineResourceFactory.ofVertexBufferDetail(arrayStride, attributes, location, step, meshBufferResource.vertices);
  },
  ofVertexBufferDetailBufferLocation: <TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMapEntity<TEntityFormat>,>(
    bufferLocation: WPKBufferLocationUserDefined<TUniformFormat, TEntityFormat, TBufferFormats>,
    bufferFormats: TBufferFormats,
    trackedBufferResources: Record<WPKBufferFormatKey<TUniformFormat, TEntityFormat, TBufferFormats>, WPKResource<WPKTrackedBuffer>>
  ): WPKResource<WPKVertexBufferDetail> => {
    lazyDebug(LOGGER, () => 'Creating vertex buffer detail resource from buffer location');
    const { buffer, location, step } = bufferLocation;
    const bufferFormat = bufferFormats[buffer];
    const bufferResource = trackedBufferResources[buffer];
    const { contentType } = bufferFormat;
    const arrayStride = (contentType === 'layout')
      ? strideFuncs.ofFormatLayout(bufferFormat.layout)
      : strideFuncs.ofFormatMarshall(bufferFormat.marshall);
    const attributes = (contentType === 'layout')
      ? pipelineResourceFactory.ofVertexAttributes(location, bufferFormat.layout, pipelineResourceFactory.ofVertexFormatLayout, strideFuncs.ofLayout)
      : pipelineResourceFactory.ofVertexAttributes(location, bufferFormat.marshall, pipelineResourceFactory.ofVertexFormatUserFormat, strideFuncs.ofUserFormat);
    return pipelineResourceFactory.ofVertexBufferDetail(arrayStride, attributes, location, step, bufferResource);
  },
  ofVertexAttributes: <T>(shaderLocation: number, array: NonEmptyArray<T>, toFormat: (element: T) => GPUVertexFormat, toStride: (element: T) => number): GPUVertexAttribute[] => {
    lazyDebug(LOGGER, () => 'Creating vertex attributes');
    let offset = 0;
    return array.map((element): GPUVertexAttribute => {
      const format = toFormat(element);
      const stride = toStride(element);
      const attribute: GPUVertexAttribute = {
        format,
        offset,
        shaderLocation,
      };
      offset += stride;
      return attribute;
    });
  },
  ofVertexFormatLayout: (layout: WPKLayout): GPUVertexFormat => {
    lazyDebug(LOGGER, () => `Calculating vertex format from layout ${JSON.stringify(layout)}`);
    const { datumType, dimension } = layout;
    switch (dimension) {
      case 'scalar': return datumType;
      case 'vec2': return `${datumType}x2`;
      case 'vec3': return `${datumType}x3`;
      case 'vec4': return `${datumType}x4`;
    }
  },
  ofVertexFormatUserFormat: <TFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TFormat, any>): GPUVertexFormat => {
    lazyDebug(LOGGER, () => `Calculating vertex format from user format ${JSON.stringify(userFormat)}`);
    const { datumType } = userFormat;
    const dimensionMultiple = strideFuncs.dimensionMultipleOfUserFormat(userFormat);
    return (dimensionMultiple === 1)
      ? datumType
      : `${datumType}x${dimensionMultiple}` as GPUVertexFormat;
  },
  ofVertexBufferDetail: (
    arrayStride: number,
    attributes: GPUVertexAttribute[],
    location: number,
    step: GPUVertexStepMode,
    bufferResource: WPKResource<WPKTrackedBuffer>
  ): WPKResource<WPKVertexBufferDetail> => {
    lazyDebug(LOGGER, () => 'Creating vertex buffer detail resource');
    return resourceFactory.ofCachedFromDependencies(
      [bufferResource] as const,
      (_device, _queue, _encoder, values) => {
        lazyTrace(LOGGER, () => 'Creating vertex buffer detail');
        return {
          buffer: values[0].buffer,
          layout: {
            arrayStride,
            attributes,
            stepMode: step,
          },
          location,
        };
      },
    );
  },
  ofVertexBuffers: (
    vertexBufferDetailResources: WPKResource<WPKVertexBufferDetail>[]
  ): WPKResource<GPUBuffer[]> => {
    lazyDebug(LOGGER, () => 'Creating vertex buffers resource');
    return resourceFactory.ofCachedFromDependencies(
      vertexBufferDetailResources,
      (device, queue, encoder, values) => {
        lazyTrace(LOGGER, () => 'Creating vertex buffers');
        return values.map((data) => data.buffer);
      },
    );
  },
  ofVertexBufferLayouts: (
    vertexBufferDetailsResource: WPKResource<WPKVertexBufferDetail[]>
  ): WPKResource<GPUVertexBufferLayout[]> => {
    lazyDebug(LOGGER, () => 'Creating vertex buffer layouts resource');
    return resourceFactory.ofCachedFromDependencies(
      [vertexBufferDetailsResource] as const,
      (_device, _queue, _encoder, values) => {
        lazyTrace(LOGGER, () => 'Creating vertex buffer layouts');
        return values[0].map((data) => data.layout);
      },
    );
  },
  ofRenderPipeline: (
    name: string,
    index: number,
    mesh: WPKMesh,
    shaderModuleResource: WPKResource<GPUShaderModule>,
    vertexShaderEntryPoint: string,
    fragmentShaderEntryPoint: string,
    vertexBufferLayoutsResource: WPKResource<GPUVertexBufferLayout[]>,
    renderPipelineLayoutResource: WPKResource<GPUPipelineLayout>,
    isAntiAliasedFunc: () => boolean,
    textureFormatFunc: () => GPUTextureFormat,
  ): WPKResource<GPURenderPipeline> => {
    const label = `${name}-render-pipeline-${index}`;
    lazyDebug(LOGGER, () => `Creating render pipeline resource ${label}`);
    const topology = mesh.topology;
    const frontFace = mesh.winding;
    const cullMode = meshFuncs.cullMode(mesh);
    const isAntiAliasedResource: WPKResource<boolean> = {
      get: (_device, _queue, _encoder) => isAntiAliasedFunc(),
    };
    const textureFormatResource: WPKResource<GPUTextureFormat> = {
      get: (_device, _queue, _encoder) => textureFormatFunc(),
    };
    return resourceFactory.ofCachedFromDependencies(
      [renderPipelineLayoutResource, shaderModuleResource, vertexBufferLayoutsResource, isAntiAliasedResource, textureFormatResource] as const,
      (device, queue, encoder, values) => {
        lazyTrace(LOGGER, () => `Creating render pipeline ${label}`);
        return device.createRenderPipeline({
          label,
          layout: values[0],
          vertex: {
            module: values[1],
            entryPoint: vertexShaderEntryPoint,
            buffers: values[2],
          },
          fragment: {
            module: values[1],
            entryPoint: fragmentShaderEntryPoint,
            targets: [{
              format: values[4],
            }],
          },
          multisample: {
            count: pipelineFuncs.toSampleCount(values[3]),
          },
          primitive: {
            topology,
            frontFace,
            cullMode,
          },
        });
      },
    );
  },
  ofRenderPipelineDetail: (
    indicesType: GPUIndexFormat,
    bindGroupsDetailResource: WPKResource<WPKBindGroupsDetail>,
    indicesBufferResource: WPKResource<GPUBuffer>,
    vertexBuffersResource: WPKResource<GPUBuffer[]>,
    renderPipelineResource: WPKResource<GPURenderPipeline>,
    drawCountsFunc: () => WPKDrawCounts,
  ): WPKResource<WPKRenderPipelineDetail> => {
    lazyDebug(LOGGER, () => 'Creating render pipeline detail resource');
    return resourceFactory.ofCachedFromDependencies(
      [bindGroupsDetailResource, indicesBufferResource, vertexBuffersResource, renderPipelineResource] as const,
      (device, queue, encoder, values) => {
        lazyTrace(LOGGER, () => 'Creating render pipeline detail');
        return ({
          bindGroups: values[0],
          indices: {
            buffer: values[1],
            format: indicesType,
          },
          vertexBuffers: values[2],
          pipeline: values[3],
          drawCountsFunc,
        });
      }
    );
  },
};
