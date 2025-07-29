import { PipelineUtils } from './utils';

export type Views = {
    view: GPUTextureView;
    resolveTarget?: GPUTextureView;
};

export type ViewsGetter = (isAntiAliased: boolean) => Views;

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
  const sampleCount = PipelineUtils.toSampleCount(true);
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

export const ViewsGetter = {
  of: (
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    device: GPUDevice,
    format: GPUTextureFormat,
  ): ViewsGetter => {
    let antiAliasingTexture: GPUTexture | undefined;
    return (isAntiAliased: boolean): Views => {
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
  },
};
