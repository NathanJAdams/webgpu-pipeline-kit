import { getLogger } from './logging';
import { addPeripheralEventHandlers } from './peripheral-events';
import { pipelineFuncs } from './pipeline-utils';
import { WPKAddPipelineOptions, WPKAddPipelineOptionsAddAfter, WPKAddPipelineOptionsAddBefore, WPKComputePipelineDetail, WPKEventListenerRemover, WPKPipeline, WPKPipelineDetail, WPKPipelineInvoker, WPKPipelineRunner, WPKRenderPipelineDetail, WPKRenderPipelineOptions, WPKViews, WPKViewsFunc } from './types';
import { logFuncs } from './utils';

const LOGGER = getLogger('pipeline');

const isOptionsAddBefore = (options?: WPKAddPipelineOptions): options is WPKAddPipelineOptionsAddBefore => (options !== undefined && (options as WPKAddPipelineOptionsAddBefore).before !== undefined);
const isOptionsAddAfter = (options?: WPKAddPipelineOptions): options is WPKAddPipelineOptionsAddAfter => (options !== undefined && (options as WPKAddPipelineOptionsAddAfter).after !== undefined);

export const pipelineRunnerFactory = {
  create: async (renderOptions?: WPKRenderPipelineOptions): Promise<WPKPipelineRunner> => {
    logFuncs.lazyInfo(LOGGER, () => 'Creating pipeline runner');
    const gpu = pipelineFuncs.getGpu();
    const device = await pipelineFuncs.getDevice(gpu);
    let getViews: WPKViewsFunc;
    let clearValue: number[];
    let remover: WPKEventListenerRemover;
    if (renderOptions === undefined) {
      getViews = (() => ({})) as WPKViewsFunc;
      clearValue = [];
      remover = { remove() { }, };
    } else {
      getViews = await createViewsGetter(renderOptions.canvas, device);
      clearValue = [renderOptions.clearColor.r, renderOptions.clearColor.g, renderOptions.clearColor.b, renderOptions.clearColor.a];
      remover = addPeripheralEventHandlers(renderOptions.canvas, renderOptions.peripheralEventHandlers);
    }
    const invoker: WPKPipelineInvoker = (encoder, index, detail) => {
      logFuncs.lazyTrace(LOGGER, () => `Invoking pipeline ${JSON.stringify(detail)}`);
      const { compute, render } = detail;
      if (compute !== undefined) {
        invokeComputePipeline(compute, index, encoder);
      }
      if (render !== undefined) {
        if (renderOptions === undefined) {
          logFuncs.lazyWarn(LOGGER, () => `Cannot invoke render pipeline for ${detail.name}, set render options parameter when creating pipeline runner`);
        } else {
          const views = getViews();
          invokeRenderPipeline(render, index, encoder, views, clearValue);
        }
      }
    };
    return createPipelineRunner(device, invoker, remover);
  },
};

const createViewsGetter = async (canvas: HTMLCanvasElement, device: GPUDevice): Promise<WPKViewsFunc> => {
  const context = pipelineFuncs.getContext(canvas);
  const gpu = pipelineFuncs.getGpu();
  const format = pipelineFuncs.getFormat(gpu);
  const alphaMode = 'opaque';
  context.configure({
    alphaMode,
    device,
    format,
  });
  return createViewsFunc(canvas, context, device, format);
};

const createPipelineRunner = async (
  device: GPUDevice,
  pipelineInvoker: (encoder: GPUCommandEncoder, index: number, detail: WPKPipelineDetail) => void,
  remover?: WPKEventListenerRemover
): Promise<WPKPipelineRunner> => {
  logFuncs.lazyInfo(LOGGER, () => 'Creating pipeline runner');
  const pipelines: WPKPipeline<any, any, any, any, any>[] = [];
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
    async step() {
      const encoder = device.createCommandEncoder({
        label: 'command-encoder',
      });
      const { queue } = device;
      logFuncs.lazyTrace(LOGGER, () => `Creating pipeline details from ${pipelines.length} pipelines`);
      const pipelineDetails = pipelines.map((pipeline) => pipeline.pipelineDetail(device, queue, encoder));
      const invalidPipelineNames = pipelineDetails
        .filter((pipelineDetail) => pipelineDetail.instanceCount === 0)
        .map(pipelineDetail => pipelineDetail.name);
      if (invalidPipelineNames.length > 0) {
        logFuncs.lazyInfo(LOGGER, () => `No entities for pipelines [${invalidPipelineNames.join(', ')}]`);
      }
      const validPipelines = pipelineDetails.filter((pipelineDetail) => pipelineDetail.instanceCount > 0);
      logFuncs.lazyDebug(LOGGER, () => `Invoking ${validPipelines.length} valid pipelines`);
      for (const [pipelineIndex, pipelineDetail] of validPipelines.entries()) {
        pipelineInvoker(encoder, pipelineIndex, pipelineDetail);
      }
      logFuncs.lazyTrace(LOGGER, () => `Call read back function ${validPipelines.length} pipelines`);
      const pipelineReadBackFuncs = validPipelines
        .map(pipeline => pipeline.readBackFuncs)
        .filter(readBackFuncs => readBackFuncs !== undefined);
      for (const readBackFuncs of pipelineReadBackFuncs) {
        readBackFuncs.copyData(encoder);
      }
      logFuncs.lazyTrace(LOGGER, () => 'Submit encoder commands');
      device.queue.submit([encoder.finish()]);
      const readBackPromises = pipelineReadBackFuncs.map(readBackFuncs => readBackFuncs.readBack());
      await Promise.all(readBackPromises);
      logFuncs.lazyTrace(LOGGER, () => `Clean ${pipelines.length} pipelines`);
      pipelines.forEach(pipeline => pipeline.clean());
    },
    destroy() {
      device.destroy();
      if (remover !== undefined) {
        remover.remove();
      }
    },
  };
};

const invokeComputePipeline = (compute: WPKComputePipelineDetail[], pipelineIndex: number, encoder: GPUCommandEncoder): void => {
  logFuncs.lazyTrace(LOGGER, () => `Compute shader of pipeline[${pipelineIndex}]`);
  const computePass = encoder.beginComputePass();
  for (const [computeEntryIndex, computeEntry] of compute.entries()) {
    logFuncs.lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}]`);
    const { bindGroups, pipeline, dispatchCount } = computeEntry;
    computePass.setPipeline(pipeline);
    for (const bindGroup of bindGroups) {
      logFuncs.lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}] set bind group at index ${bindGroup.index} to ${bindGroup.group.label}`);
      computePass.setBindGroup(bindGroup.index, bindGroup.group);
    }
    logFuncs.lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}] dispatch size ${JSON.stringify(dispatchCount)}`);
    computePass.dispatchWorkgroups(dispatchCount[0], dispatchCount[1], dispatchCount[2]);
  }
  logFuncs.lazyTrace(LOGGER, () => `End compute pass of pipeline[${pipelineIndex}]`);
  computePass.end();
};

const invokeRenderPipeline = (render: WPKRenderPipelineDetail[], pipelineIndex: number, encoder: GPUCommandEncoder, views: WPKViews, clearValue: number[]): void => {
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
      logFuncs.lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] set bind group at index ${bindGroup.index} to ${bindGroup.group.label}`);
      renderPass.setBindGroup(bindGroup.index, bindGroup.group);
    }
    logFuncs.lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] set indices buffer`);
    renderPass.setIndexBuffer(indices.buffer, indices.format);
    logFuncs.lazyTrace(LOGGER, () => `Setting ${vertexBuffers.length} vertex buffers`);
    for (const [slot, vertexBuffer] of vertexBuffers.entries()) {
      logFuncs.lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] set vertex buffer in slot ${slot} ${vertexBuffer.label}`);
      renderPass.setVertexBuffer(slot, vertexBuffer);
    }
    logFuncs.lazyTrace(LOGGER, () => `Render pipeline[${pipelineIndex}] entry[${renderEntryIndex}] draw indexed ${JSON.stringify(drawCounts)}`);
    renderPass.drawIndexed(drawCounts.indexCount, drawCounts.instanceCount);
  }
  logFuncs.lazyTrace(LOGGER, () => `End render pass of pipeline[${pipelineIndex}]`);
  renderPass.end();
};

const createViewsFunc = (canvas: HTMLCanvasElement, context: GPUCanvasContext, device: GPUDevice, format: GPUTextureFormat): WPKViewsFunc => {
  let viewTexture: GPUTexture | undefined;
  return (): WPKViews => {
    const contextView = context.getCurrentTexture().createView();
    viewTexture = getOrCreateTexture(canvas, device, format, viewTexture);
    const resolveTarget = contextView;
    const view = viewTexture.createView();
    return {
      resolveTarget,
      view,
    };
  };
};

const getOrCreateTexture = (
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
  const sampleCount = pipelineFuncs.ANTI_ALIASED_SAMPLE_COUNT;
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

const toInsertIndex = (pipelines: WPKPipeline<any, any, any, any, any>[], options?: WPKAddPipelineOptions): number => {
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
