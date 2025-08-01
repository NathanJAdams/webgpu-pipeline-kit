import { WPKBufferFormatKey, WPKBufferFormatMap } from './buffer-format';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { WPKResource } from './resources';

export type WPKTrackedBuffer = {
  isNew: boolean;
  buffer: GPUBuffer;
  destroy: () => void;
};

export type WPKMeshBufferResource = {
  indices: WPKResource<WPKTrackedBuffer>;
  vertices: WPKResource<WPKTrackedBuffer>;
};

export type WPKMutateUniform<TFormat extends WPKInstanceFormat> = {
  mutateUniform: (uniform: WPKInstanceOf<TFormat>) => void;
};
export type WPKResizeInstances<TFormat extends WPKInstanceFormat> = {
  add: (instance: WPKInstanceOf<TFormat>) => string;
  remove: (instanceId: string) => void;
};
export type WPKMutateByIndex<TFormat extends WPKInstanceFormat> = {
  mutateInstanceByIndex: (index: number, instance: WPKInstanceOf<TFormat>) => void;
};
export type WPKMutateById<TFormat extends WPKInstanceFormat> = {
  mutateInstanceById: (id: string, instance: WPKInstanceOf<TFormat>) => void;
};

export type WPKMutableOptions<TMutableUniform extends boolean, TMutableInstances extends boolean, TResizeableInstances extends boolean> = {
  isMutableUniform: TMutableUniform;
  isMutableInstances: TMutableInstances;
  isResizeableInstances: TResizeableInstances;
};
export type WPKBufferResources<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>, TMutableUniforms extends boolean, TMutableInstances extends boolean, TResizeableInstances extends boolean> = {
  buffers: Record<WPKBufferFormatKey<TBufferFormats>, WPKResource<WPKTrackedBuffer>>;
  instanceCount: () => number;
  update: () => void;
}
  & (TMutableUniforms extends true
    ? WPKMutateUniform<TUniformFormat>
    : object
  )
  & (TMutableInstances extends true
    ? TResizeableInstances extends true
    ? WPKMutateById<TEntityFormat>
    : WPKMutateByIndex<TEntityFormat>
    : object
  )
  & (TResizeableInstances extends true
    ? WPKResizeInstances<TEntityFormat>
    : object
  );
