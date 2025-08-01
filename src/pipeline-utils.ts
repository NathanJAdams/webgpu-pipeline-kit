export type WPKWorkGroupSize = {
    x: number;
    y?: number;
    z?: number;
};

export const pipelineFuncs = {
  toByteLength: (format: GPUVertexFormat): number => {
    switch (format) {
      case 'float16': return 2 * 1;
      case 'float16x2': return 2 * 2;
      case 'float16x4': return 2 * 4;
      case 'float32': return 4 * 1;
      case 'float32x2': return 4 * 2;
      case 'float32x3': return 4 * 3;
      case 'float32x4': return 4 * 4;
      case 'sint16': return 2 * 1;
      case 'sint16x2': return 2 * 2;
      case 'sint16x4': return 2 * 4;
      case 'sint32': return 4 * 1;
      case 'sint32x2': return 4 * 2;
      case 'sint32x3': return 4 * 3;
      case 'sint32x4': return 4 * 4;
      case 'sint8': return 1 * 1;
      case 'sint8x2': return 1 * 2;
      case 'sint8x4': return 1 * 4;
      case 'snorm16': return 2 * 1;
      case 'snorm16x2': return 2 * 2;
      case 'snorm16x4': return 2 * 4;
      case 'snorm8': return 1 * 1;
      case 'snorm8x2': return 1 * 2;
      case 'snorm8x4': return 1 * 4;
      case 'uint16': return 2 * 1;
      case 'uint16x2': return 2 * 2;
      case 'uint16x4': return 2 * 4;
      case 'uint32': return 4 * 1;
      case 'uint32x2': return 4 * 2;
      case 'uint32x3': return 4 * 3;
      case 'uint32x4': return 4 * 4;
      case 'uint8': return 1 * 1;
      case 'uint8x2': return 1 * 2;
      case 'uint8x4': return 1 * 4;
      case 'unorm10-10-10-2': return 4 * 1;
      case 'unorm16': return 2 * 1;
      case 'unorm16x2': return 2 * 2;
      case 'unorm16x4': return 2 * 4;
      case 'unorm8': return 1 * 1;
      case 'unorm8x2': return 1 * 2;
      case 'unorm8x4': return 1 * 4;
      case 'unorm8x4-bgra': return 1 * 4;
    }
  },
  toByteLengthTotal: (formats: GPUVertexFormat[]): number => formats.reduce((currentByteLength, format) => currentByteLength + pipelineFuncs.toByteLength(format), 0),
  toSampleCount: (isAntiAliased: boolean): number => isAntiAliased ? 4 : 1,
  toWorkGroupSize: (size: WPKWorkGroupSize, instanceCount: number): WPKWorkGroupSize => {
    const totalThreads = size.x * (size.y || 1) * (size.z || 1);
    const x = Math.ceil(instanceCount / totalThreads);
    return {
      x,
      y: 1,
      z: 1,
    };
  },
  getContext: (canvas: HTMLCanvasElement): GPUCanvasContext => {
    const context = canvas.getContext('webgpu');
    if (context === null) {
      throw Error('Failed to get WebGPU context from canvas');
    }
    return context;
  },
  getGpu: (): GPU => {
    const { gpu } = navigator;
    if (gpu === undefined) {
      throw Error('WebGPU not supported in this browser');
    }
    return gpu;
  },
  getFormat: (): GPUTextureFormat => {
    const gpu = pipelineFuncs.getGpu();
    return gpu.getPreferredCanvasFormat();
  },
  getDevice: async (): Promise<GPUDevice> => {
    const gpu = pipelineFuncs.getGpu();
    const adapter = await gpu.requestAdapter();
    if (adapter === null) {
      throw Error('Failed to request GPU adapter');
    }
    return await adapter.requestDevice();
  },
};
