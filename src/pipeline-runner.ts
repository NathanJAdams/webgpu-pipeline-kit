import { logFactory } from './logging';
import { addPeripheralEventHandlers } from './peripheral-events';
import { pipelineFuncs } from './pipeline-utils';
import { WPKAddPipelineOptions, WPKAddPipelineOptionsAddAfter, WPKAddPipelineOptionsAddBefore, WPKComputePipelineDetail, WPKPeripheralEventHandlers, WPKPipeline, WPKPipelineDetail, WPKPipelineInvoker, WPKPipelineRunner, WPKRenderPipelineDetail, WPKViews, WPKViewsFunc } from './types';
import { Color, logFuncs } from './utils';

const LOGGER = logFactory.getLogger('pipeline');

const isOptionsAddBefore = (options?: WPKAddPipelineOptions): options is WPKAddPipelineOptionsAddBefore => (options !== undefined && (options as WPKAddPipelineOptionsAddBefore).before !== undefined);
const isOptionsAddAfter = (options?: WPKAddPipelineOptions): options is WPKAddPipelineOptionsAddAfter => (options !== undefined && (options as WPKAddPipelineOptionsAddAfter).after !== undefined);

export const pipelineRunnerFactory = {
  ofCompute: async (): Promise<WPKPipelineRunner<true, false>> => {
    const gpu = pipelineFuncs.getGpu();
    const device = await pipelineFuncs.getDevice(gpu);
    const invoker: WPKPipelineInvoker<true, false> = (encoder, index, detail) => {
      logFuncs.lazyTrace(LOGGER, () => `Invoking pipeline ${JSON.stringify(detail)}`);
      const { compute } = detail;
      if (compute !== undefined) {
        invokeComputePipeline(compute, index, encoder);
      }
    };
    return createPipelineRunner(device, invoker);
  },
  ofComputeRender: async (canvas: HTMLCanvasElement, clearColor: Color, peripheralEventHandlers: WPKPeripheralEventHandlers): Promise<WPKPipelineRunner<true, true>> => {
    logFuncs.lazyInfo(LOGGER, () => 'Creating pipeline runner');
    const gpu = pipelineFuncs.getGpu();
    const device = await pipelineFuncs.getDevice(gpu);
    const getViews = await createViewsGetter(canvas, device);
    const clearValue = [clearColor.r, clearColor.g, clearColor.b, clearColor.a];
    const invoker: WPKPipelineInvoker<true, true> = (encoder, index, detail) => {
      logFuncs.lazyTrace(LOGGER, () => `Invoking pipeline ${JSON.stringify(detail)}`);
      const { compute, render } = detail;
      if (compute !== undefined) {
        invokeComputePipeline(compute, index, encoder);
      }
      if (render !== undefined) {
        const views = getViews();
        invokeRenderPipeline(render, index, encoder, views, clearValue);
      }
    };
    await addPeripheralEventHandlers(canvas, peripheralEventHandlers);
    return createPipelineRunner(device, invoker);
  },
  ofRender: async (canvas: HTMLCanvasElement, clearColor: Color, peripheralEventHandlers: WPKPeripheralEventHandlers): Promise<WPKPipelineRunner<false, true>> => {
    logFuncs.lazyInfo(LOGGER, () => 'Creating pipeline runner');
    const gpu = pipelineFuncs.getGpu();
    const device = await pipelineFuncs.getDevice(gpu);
    const getViews = await createViewsGetter(canvas, device);
    const clearValue = [clearColor.r, clearColor.g, clearColor.b, clearColor.a];
    const invoker: WPKPipelineInvoker<false, true> = (encoder, index, detail) => {
      logFuncs.lazyTrace(LOGGER, () => `Invoking pipeline ${JSON.stringify(detail)}`);
      const { render } = detail;
      if (render !== undefined) {
        const views = getViews();
        invokeRenderPipeline(render, index, encoder, views, clearValue);
      }
    };
    await addPeripheralEventHandlers(canvas, peripheralEventHandlers);
    return createPipelineRunner(device, invoker);
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

const createPipelineRunner = async <TCompute extends boolean, TRender extends boolean>(
  device: GPUDevice,
  pipelineInvoker: (encoder: GPUCommandEncoder, index: number, detail: WPKPipelineDetail<TCompute, TRender>) => void
): Promise<WPKPipelineRunner<TCompute, TRender>> => {
  logFuncs.lazyInfo(LOGGER, () => 'Creating pipeline runner');
  const pipelines: WPKPipeline<any, any, any, any, any, TCompute, TRender>[] = [];
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
      logFuncs.lazyTrace(LOGGER, () => `Submit encoder for ${validPipelines.length} pipelines`);
      device.queue.submit([encoder.finish()]);
      logFuncs.lazyTrace(LOGGER, () => `Call debug function ${validPipelines.length} pipelines`);
      for (const pipelineDetail of validPipelines.values()) {
        const { debugFunc } = pipelineDetail;
        if (debugFunc !== undefined) {
          await debugFunc();
        }
      }
      pipelines.forEach(pipeline => pipeline.clean());
    },
  };
};

const invokeComputePipeline = (compute: WPKComputePipelineDetail[], pipelineIndex: number, encoder: GPUCommandEncoder): void => {
  logFuncs.lazyTrace(LOGGER, () => `Compute shader of pipeline[${pipelineIndex}]`);
  const computePass = encoder.beginComputePass();
  for (const [computeEntryIndex, computeEntry] of compute.entries()) {
    logFuncs.lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}]`);
    const { bindGroups, pipeline, dispatchSize } = computeEntry;
    computePass.setPipeline(pipeline);
    for (const bindGroup of bindGroups) {
      logFuncs.lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}] set bind group at index ${bindGroup.index} to ${bindGroup.group.label}`);
      computePass.setBindGroup(bindGroup.index, bindGroup.group);
    }
    logFuncs.lazyTrace(LOGGER, () => `Compute pipeline[${pipelineIndex}] entry[${computeEntryIndex}] dispatch size ${JSON.stringify(dispatchSize)}`);
    computePass.dispatchWorkgroups(dispatchSize[0], dispatchSize[1], dispatchSize[2]);
  }
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

const toInsertIndex = (pipelines: WPKPipeline<any, any, any, any, any, any, any>[], options?: WPKAddPipelineOptions): number => {
  if (isOptionsAddBefore(options)) {
    return toInsertIndexFromName(pipelines, options.before, false);
  } else if (isOptionsAddAfter(options)) {
    return toInsertIndexFromName(pipelines, options.after, true);
  } else {
    return pipelines.length;
  }
};

const toInsertIndexFromName = (pipelines: WPKPipeline<any, any, any, any, any, any, any>[], name: string, incrementFoundIndex: boolean): number => {
  const index = toIndexFromName(pipelines, name);
  return (index === -1)
    ? pipelines.length
    : index + (incrementFoundIndex ? 1 : 0);
};

const toIndexFromName = (pipelines: WPKPipeline<any, any, any, any, any, any, any>[], name: string): number => pipelines.findIndex((pipeline) => pipeline.name === name);
