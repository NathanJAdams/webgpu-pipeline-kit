import { getLogger, lazyTrace } from './logging';

export type WPKWorkGroupSize = {
  x: number;
  y?: number;
  z?: number;
};

const LOGGER = getLogger('pipeline');

const VERTEX_FORMAT_BYTE_LENGTHS: Record<GPUVertexFormat, number> = {
  float16: 2 * 1,
  float16x2: 2 * 2,
  float16x4: 2 * 4,
  float32: 4 * 1,
  float32x2: 4 * 2,
  float32x3: 4 * 3,
  float32x4: 4 * 4,
  sint8: 1 * 1,
  sint8x2: 1 * 2,
  sint8x4: 1 * 4,
  sint16: 2 * 1,
  sint16x2: 2 * 2,
  sint16x4: 2 * 4,
  sint32: 4 * 1,
  sint32x2: 4 * 2,
  sint32x3: 4 * 3,
  sint32x4: 4 * 4,
  snorm8: 1 * 1,
  snorm8x2: 1 * 2,
  snorm8x4: 1 * 4,
  snorm16: 2 * 1,
  snorm16x2: 2 * 2,
  snorm16x4: 2 * 4,
  uint8: 1 * 1,
  uint8x2: 1 * 2,
  uint8x4: 1 * 4,
  uint16: 2 * 1,
  uint16x2: 2 * 2,
  uint16x4: 2 * 4,
  uint32: 4 * 1,
  uint32x2: 4 * 2,
  uint32x3: 4 * 3,
  uint32x4: 4 * 4,
  unorm8: 1 * 1,
  unorm8x2: 1 * 2,
  unorm8x4: 1 * 4,
  unorm16: 2 * 1,
  unorm16x2: 2 * 2,
  unorm16x4: 2 * 4,
  'unorm8x4-bgra': 1 * 4,
  'unorm10-10-10-2': 10 + 10 + 10 + 2,
};

export const pipelineFuncs = {
  toByteLength: (format: GPUVertexFormat): number => {
    const byteLength = VERTEX_FORMAT_BYTE_LENGTHS[format];
    lazyTrace(LOGGER, () => `Byte length of '${format}' is ${byteLength}`);
    return byteLength;
  },
  toByteLengthTotal: (formats: GPUVertexFormat[]): number => {
    const totalByteLength = formats.reduce((currentByteLength, format) => currentByteLength + pipelineFuncs.toByteLength(format), 0);
    lazyTrace(LOGGER, () => `Total byte length of '${JSON.stringify(formats)}' is ${totalByteLength}`);
    return totalByteLength;
  },
  toSampleCount: (isAntiAliased: boolean): number => isAntiAliased ? 4 : 1,
  toWorkGroupSize: (size: WPKWorkGroupSize, instanceCount: number): WPKWorkGroupSize => {
    const totalThreads = size.x * (size.y || 1) * (size.z || 1);
    const x = Math.ceil(instanceCount / totalThreads);
    const workGroupSize: WPKWorkGroupSize = {
      x,
      y: 1,
      z: 1,
    };
    lazyTrace(LOGGER, () => `Calculated work group size from ${JSON.stringify(size)} and instance count ${instanceCount} is ${JSON.stringify(workGroupSize)}`);
    return workGroupSize;
  },
  getContext: (canvas: HTMLCanvasElement): GPUCanvasContext => {
    lazyTrace(LOGGER, () => 'Get webgpu context from canvas');
    const context = canvas.getContext('webgpu');
    if (context === null) {
      throw Error('Failed to get WebGPU context from canvas');
    }
    return context;
  },
  getGpu: (): GPU => {
    lazyTrace(LOGGER, () => 'Get gpu from navigator');
    const { gpu } = navigator;
    if (gpu === undefined) {
      throw Error('WebGPU not supported in this browser');
    }
    return gpu;
  },
  getFormat: (gpu: GPU): GPUTextureFormat => {
    lazyTrace(LOGGER, () => 'Get format from gpu');
    return gpu.getPreferredCanvasFormat();
  },
  getDevice: async (gpu: GPU): Promise<GPUDevice> => {
    lazyTrace(LOGGER, () => 'Get adapter from gpu');
    const adapter = await gpu.requestAdapter();
    if (adapter === null) {
      throw Error('Failed to request GPU adapter');
    }
    lazyTrace(LOGGER, () => 'Get device from adapter');
    return await adapter.requestDevice();
  },
};
