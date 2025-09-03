import { logFactory } from './logging';
import { pipelineFuncs } from './pipeline-utils';
import { WPKPipeline, WPKPipelineDetailOptions, WPKViews, WPKViewsFunc } from './types';
import { WPKDisplay, WPKDisplayAddPipelineOptions, WPKDisplayAddPipelineOptionsAddAfter, WPKDisplayAddPipelineOptionsAddBefore } from './types';
import { logFuncs } from './utils';

const LOGGER = logFactory.getLogger('pipeline');

const isOptionsAddBefore = (options?: WPKDisplayAddPipelineOptions): options is WPKDisplayAddPipelineOptionsAddBefore => (options !== undefined && (options as WPKDisplayAddPipelineOptionsAddBefore).before !== undefined);
const isOptionsAddAfter = (options?: WPKDisplayAddPipelineOptions): options is WPKDisplayAddPipelineOptionsAddAfter => (options !== undefined && (options as WPKDisplayAddPipelineOptionsAddAfter).after !== undefined);

export const displayFactory = {
  of: async (canvas: HTMLCanvasElement): Promise<WPKDisplay> => {
    logFuncs.lazyInfo(LOGGER, () => 'Creating pipeline runner');
    const pipelines: WPKPipeline<any, any, any, any, any>[] = [];
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
    const getViews = createViewsFunc(canvas, context, device, format);
    return {
      add(pipeline, options) {
        const { name } = pipeline;
        if (pipelines.findIndex((pipeline) => pipeline.name === name) !== -1) {
          throw Error(`Cannot add a pipeline with duplicate name '${name}'`);
        }
        const insertIndex = toInsertIndex(pipelines, options);
        logFuncs.lazyInfo(LOGGER, () => `Adding pipeline '${name}'`);
        pipelines.splice(insertIndex, 0, pipeline);
      },
      remove(name) {
        const removeIndex = toInsertIndexFromName(pipelines, name, false);
        if (removeIndex === -1) {
          logFuncs.lazyWarn(LOGGER, () => `No pipeline to remove with name '${name}'`);
        } else {
          logFuncs.lazyInfo(LOGGER, () => `Removing pipeline '${name}'`);
          pipelines.splice(removeIndex, 1);
        }
      },
      // async not strictly needed, but useful to prevent changing signature in case future changes need it
      async display(options) {
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
        logFuncs.lazyTrace(LOGGER, () => `Creating pipeline details from ${pipelines.length} pipelines`);
        const pipelineDetails = pipelines.map((pipeline) => pipeline.pipelineDetail(device, queue, encoder, detailOptions));
        const invalidPipelineNames = pipelineDetails
          .filter((pipelineDetail) => pipelineDetail.instanceCount === 0)
          .map(pipelineDetail => pipelineDetail.name);
        if (invalidPipelineNames.length > 0) {
          logFuncs.lazyInfo(LOGGER, () => `No entities for pipelines [${invalidPipelineNames.join(', ')}]`);
        }
        const validPipelines = pipelineDetails.filter((pipelineDetail) => pipelineDetail.instanceCount > 0);
        logFuncs.lazyDebug(LOGGER, () => `Invoking ${validPipelines.length} valid pipelines`);
        for (const [pipelineIndex, pipelineDetail] of validPipelines.entries()) {
          logFuncs.lazyTrace(LOGGER, () => `Invoking pipeline ${JSON.stringify(pipelineDetail)}`);
          const { compute } = pipelineDetail;
          if (compute !== undefined) {
            logFuncs.lazyTrace(LOGGER, () => `Compute shader of pipeline[${pipelineIndex}]`);
            const computePass = encoder.beginComputePass();
            for (const [computeEntryIndex, computeEntry] of compute.entries()) {
              logFuncs.lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}]`);
              const { bindGroups, pipeline, dispatchSize } = computeEntry;
              computePass.setPipeline(pipeline);
              for (const bindGroup of bindGroups) {
                logFuncs.lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}] set bind group ${JSON.stringify(bindGroup)}`);
                computePass.setBindGroup(bindGroup.index, bindGroup.group);
              }
              logFuncs.lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}] dispatch size ${JSON.stringify(dispatchSize)}`);
              computePass.dispatchWorkgroups(dispatchSize[0], dispatchSize[1], dispatchSize[2]);
            }
            computePass.end();
          }
          const { render } = pipelineDetail;
          if (render !== undefined) {
            logFuncs.lazyTrace(LOGGER, () => `Render shader of pipeline[${pipelineIndex}]`);
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
              logFuncs.lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}]`);
              const { bindGroups, pipeline, indices, vertexBuffers, drawCountsFunc } = renderEntry;
              const drawCounts = drawCountsFunc();
              renderPass.setPipeline(pipeline);
              for (const bindGroup of bindGroups) {
                logFuncs.lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] set bind group ${JSON.stringify(bindGroup)}`);
                renderPass.setBindGroup(bindGroup.index, bindGroup.group);
              }
              logFuncs.lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] set indices buffer`);
              renderPass.setIndexBuffer(indices.buffer, indices.format);
              for (const [slot, vertexBuffer] of vertexBuffers.entries()) {
                logFuncs.lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] set vertex buffer in slot ${slot}`);
                renderPass.setVertexBuffer(slot, vertexBuffer);
              }
              logFuncs.lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] draw indexed ${JSON.stringify(drawCounts)}`);
              renderPass.drawIndexed(drawCounts.indexCount, drawCounts.instanceCount);
            }
            renderPass.end();
          }
        }
        logFuncs.lazyTrace(LOGGER, () => `Submit encoder for ${validPipelines.length} pipelines`);
        device.queue.submit([encoder.finish()]);
      },
    };
  },
};

const createViewsFunc = (canvas: HTMLCanvasElement, context: GPUCanvasContext, device: GPUDevice, format: GPUTextureFormat): WPKViewsFunc => {
  let antiAliasingTexture: GPUTexture | undefined;
  return (isAntiAliased: boolean): WPKViews => {
    const contextView = context.getCurrentTexture().createView();
    if (isAntiAliased) {
      antiAliasingTexture = getOrCreateAntiAliasingTexture(canvas, device, format, antiAliasingTexture);
      const resolveTarget = contextView;
      const view = antiAliasingTexture.createView();
      return {
        resolveTarget,
        view,
      };
    } else {
      const view = contextView;
      return {
        view,
      };
    }
  };
};

const getOrCreateAntiAliasingTexture = (
  canvas: HTMLCanvasElement,
  device: GPUDevice,
  format: GPUTextureFormat,
  previousAntiAliasingTexture: GPUTexture | undefined,
): GPUTexture => {
  const { width, height } = canvas;
  if (previousAntiAliasingTexture !== undefined) {
    if (previousAntiAliasingTexture.width === width && previousAntiAliasingTexture.height === height) {
      return previousAntiAliasingTexture;
    }
    previousAntiAliasingTexture.destroy();
    previousAntiAliasingTexture = undefined;
  }
  const sampleCount = pipelineFuncs.toSampleCount(true);
  const size = [width, height];
  const usage = GPUTextureUsage.RENDER_ATTACHMENT;
  const descriptor: GPUTextureDescriptor = {
    format,
    sampleCount,
    size,
    usage,
  };
  return device.createTexture(descriptor);
};

const toInsertIndex = (pipelines: WPKPipeline<any, any, any, any, any>[], options?: WPKDisplayAddPipelineOptions): number => {
  if (isOptionsAddBefore(options)) {
    return toInsertIndexFromName(pipelines, options.before, false);
  } else if (isOptionsAddAfter(options)) {
    return toInsertIndexFromName(pipelines, options.after, true);
  } else {
    return pipelines.length;
  }
};

const toInsertIndexFromName = (pipelines: WPKPipeline<any, any, any, any, any>[], name: string, incrementFoundIndex: boolean): number => {
  const index = toIndexFromName(pipelines, name);
  return (index === -1)
    ? pipelines.length
    : index + (incrementFoundIndex ? 1 : 0);
};

const toIndexFromName = (pipelines: WPKPipeline<any, any, any, any, any>[], name: string): number => pipelines.findIndex((pipeline) => pipeline.name === name);
