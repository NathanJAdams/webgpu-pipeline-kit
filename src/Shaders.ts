import { WGBKBufferFormatKey, WGBKBufferFormats } from './buffer-resource-types';
import { OneOrBoth, WGBKMesh, WorkGroupSize } from './utils';

type HasEntryPoint = {
    entryPoint: string;
};

export type BufferLocation<TType, TStep> = {
    type: TType;
    location: number;
    step: TStep;
};
export type MeshBufferLocation = BufferLocation<'mesh', 'vertex'> & {
    format: 'float32x3';
};
export type NonMeshBufferLocation<TBufferFormats extends WGBKBufferFormats<any, any>> = BufferLocation<'user-defined', 'instance'> & {
    buffer: WGBKBufferFormatKey<TBufferFormats>;
};

type ComputePass = HasEntryPoint & {
    workGroupSize: WorkGroupSize;
};
type RenderPass<TBufferFormats extends WGBKBufferFormats<any, any>> = {
    vertex: HasEntryPoint & {
        bufferLocations: Array<MeshBufferLocation | NonMeshBufferLocation<TBufferFormats>>;
    };
    fragment: HasEntryPoint;
};
export type BufferBinding<TBufferFormats extends WGBKBufferFormats<any, any>> = {
    group: number;
    binding: number;
    buffer: WGBKBufferFormatKey<TBufferFormats>;
};
export type ComputeShader<TBufferFormats extends WGBKBufferFormats<any, any>> = {
    compute: {
        shader: string;
        bufferBindings: Array<BufferBinding<TBufferFormats>>;
        passes: Array<ComputePass>;
    }
};
export type RenderShader<TBufferFormats extends WGBKBufferFormats<any, any>> = {
    render: {
        shader: string;
        bufferBindings: Array<BufferBinding<TBufferFormats>>;
        passes: Array<RenderPass<TBufferFormats>>;
        mesh: WGBKMesh;
    };
};
export type Shader<TBufferFormats extends WGBKBufferFormats<any, any>> = OneOrBoth<ComputeShader<TBufferFormats>, RenderShader<TBufferFormats>>;

export const isComputeShader = <TBufferFormats extends WGBKBufferFormats<any, any>>(shader: Shader<TBufferFormats>): shader is ComputeShader<TBufferFormats> => (shader as ComputeShader<TBufferFormats>).compute !== undefined;
export const isRenderShader = <TBufferFormats extends WGBKBufferFormats<any, any>>(shader: Shader<TBufferFormats>): shader is RenderShader<TBufferFormats> => (shader as RenderShader<TBufferFormats>).render !== undefined;
