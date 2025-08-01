import { pipelineFuncs } from './pipeline-utils';

type WPKViews = {
    view: GPUTextureView;
    resolveTarget?: GPUTextureView;
};

type WPKViewsFunc = (isAntiAliased: boolean) => WPKViews;

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

export const viewsFuncFactory = {
  of: (
    canvas: HTMLCanvasElement,
    context: GPUCanvasContext,
    device: GPUDevice,
    format: GPUTextureFormat,
  ): WPKViewsFunc => {
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
  },
};
