import { WPKShaderDatumType, WPKShaderStructEntry } from './types';

export const toGPUVertexFormat = (datumType: WPKShaderDatumType): GPUVertexFormat[] => {
  const gpuScalar = toGPUScalar(datumType);
  if (gpuScalar !== undefined) {
    return [gpuScalar];
  }
  const vecMatch = datumType.match(/^vec([2-4])<(\w+)>$/);
  if (vecMatch) {
    const size = Number(vecMatch[1]);
    const scalar = vecMatch[2];
    const gpuScalar = toGPUScalar(scalar);
    if (gpuScalar === undefined) {
      throw new Error(`Unsupported scalar type in vec${size}: ${scalar}`);
    }
    return [`${gpuScalar}x${size}` as GPUVertexFormat];
  }
  const matMatch = datumType.match(/^mat([2-4])x([2-4])<f32>$/);
  if (matMatch) {
    const cols = Number(matMatch[1]);
    const rows = Number(matMatch[2]);
    // Each column is a vecN<f32>
    const format = `float32x${rows}` as GPUVertexFormat;
    return Array(cols).fill(format);
  }
  throw new Error(`Unsupported type: ${datumType}`);
};

const toGPUScalar = (scalar: string): GPUVertexFormat | undefined => {
  switch (scalar) {
    case 'i32': return 'sint32';
    case 'u32': return 'uint32';
    case 'f32': return 'float32';
  }
};

export const toStride = <T extends WPKShaderStructEntry>(datumTyped: T[]): number => datumTyped.reduce((acc, datumTyped) => acc + DATUM_TYPE_BYTE_LENGTHS[datumTyped.datumType], 0);

export const DATUM_TYPE_BYTE_LENGTHS: Record<WPKShaderDatumType, number> = {
  f32: 1,
  i32: 1,
  u32: 1,
  'vec2<i32>': 2,
  'vec2<u32>': 2,
  'vec2<f32>': 2,
  'vec3<i32>': 3,
  'vec3<u32>': 3,
  'vec3<f32>': 3,
  'vec4<i32>': 4,
  'vec4<u32>': 4,
  'vec4<f32>': 4,
  'mat2x2<f32>': 4,
  'mat2x3<f32>': 6,
  'mat2x4<f32>': 8,
  'mat3x2<f32>': 6,
  'mat3x3<f32>': 9,
  'mat3x4<f32>': 12,
  'mat4x2<f32>': 8,
  'mat4x3<f32>': 12,
  'mat4x4<f32>': 16,
};
