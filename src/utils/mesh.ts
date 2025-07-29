import { Vec3 } from './Vec3';

export type WGBKVertices = Vec3[];
export type WGBKIndices = Vec3[];

export type WGBKMesh = {
    vertices: WGBKVertices;
    indices: WGBKIndices;
    topology: GPUPrimitiveTopology;
    winding: GPUFrontFace;
};
