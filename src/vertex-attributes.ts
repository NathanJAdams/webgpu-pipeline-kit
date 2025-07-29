import { NonEmptyArray } from './utils';

export const VertexAttributes = {
  of: <T>(shaderLocation: number, array: NonEmptyArray<T>, toFormat: (element: T) => GPUVertexFormat, toStride: (element: T) => number): GPUVertexAttribute[] => {
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
};
