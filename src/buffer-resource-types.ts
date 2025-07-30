import { WGBKInstanceFormat, WGBKInstanceOf } from './instance';
import { ArrayIndex, ExactlyOne, NonEmptyArray, TupleOf } from './utils';

type ByteSimpleVertexFormat = 'sint8' | 'snorm8' | 'uint8' | 'unorm8';
type HalfSimpleVertexFormat = 'sint16' | 'snorm16' | 'uint16' | 'unorm16' | 'float16';
type FullSimpleVertexFormat = 'sint32' | 'uint32' | 'float32';
export type WGBKSimpleVertexFormat = ByteSimpleVertexFormat | HalfSimpleVertexFormat | FullSimpleVertexFormat;

export type WGBKFormatRef<T0, T1 = undefined> = {
  ref_0: T0;
} & (T1 extends undefined
  ? object
  : {
    ref_1: T1;
  });
export type WGBKScalarFormatReference<TFormat extends WGBKInstanceFormat> = {
  [K in keyof TFormat]: TFormat[K] extends 'scalar'
  ? WGBKFormatRef<K>
  : never
}[keyof TFormat];
export type WGBKTupleFormatReference<TFormat extends WGBKInstanceFormat> = {
  [K in keyof TFormat]: TFormat[K] extends number
  ? WGBKFormatRef<K, ArrayIndex<TFormat[K]>>
  : never
}[keyof TFormat];
export type WGBKNamedFormatReference<TFormat extends WGBKInstanceFormat> = {
  [K in keyof TFormat]: TFormat[K] extends readonly string[]
  ? WGBKFormatRef<K, TFormat[K][number]>
  : never
}[keyof TFormat];
export type WGBKFormatReference<TFormat extends WGBKInstanceFormat> =
  | WGBKScalarFormatReference<TFormat>
  | WGBKTupleFormatReference<TFormat>
  | WGBKNamedFormatReference<TFormat>
  ;

export type WGBKMarshalledFormatElementBase<TDatumType extends WGBKSimpleVertexFormat> = {
  datumType: TDatumType;
};
type HasScalar<TFormat extends WGBKInstanceFormat> = {
  scalar: WGBKFormatReference<TFormat>;
};
type HasVec<TFormat extends WGBKInstanceFormat, TVecLength extends number> = {
  vec: TupleOf<WGBKFormatReference<TFormat>, TVecLength>;
};
export type WGBKHasScalarXorVec<TFormat extends WGBKInstanceFormat, TVecLength extends number | undefined = undefined> = ExactlyOne<
  HasScalar<TFormat>
  & (TVecLength extends number
    ? HasVec<TFormat, TVecLength>
    : object
  )
>;
type MarshalledSimpleVecFormatElement<TFormat extends WGBKInstanceFormat> = WGBKMarshalledFormatElementBase<ByteSimpleVertexFormat | HalfSimpleVertexFormat | FullSimpleVertexFormat> & WGBKHasScalarXorVec<TFormat, 2 | 4>;
type MarshalledFullFormatElement<TFormat extends WGBKInstanceFormat> = WGBKMarshalledFormatElementBase<FullSimpleVertexFormat> & WGBKHasScalarXorVec<TFormat, 3>;
export type WGBKMarshalledFormatElement<TFormat extends WGBKInstanceFormat> =
  | MarshalledSimpleVecFormatElement<TFormat>
  | MarshalledFullFormatElement<TFormat>
  ;
export type WGBKMarshalledFormat<TFormat extends WGBKInstanceFormat> = NonEmptyArray<WGBKMarshalledFormatElement<TFormat>>;

type ElementLayoutBase<TDatumType extends WGBKSimpleVertexFormat> = {
  datumType: TDatumType;
};
type ScalarElementLayout = ElementLayoutBase<WGBKSimpleVertexFormat> & {
  dimension: 'scalar';
};
type SimpleVecElementLayout = ElementLayoutBase<WGBKSimpleVertexFormat> & {
  dimension: 'vec2' | 'vec4';
};
type FullElementLayout = ElementLayoutBase<FullSimpleVertexFormat> & {
  dimension: 'vec2' | 'vec3' | 'vec4';
};
export type WGBKElementLayout =
  | ScalarElementLayout
  | SimpleVecElementLayout
  | FullElementLayout
  ;

export type BufferContentType = 'layout' | 'marshalled';
type HasBufferContentType<TBufferContentType extends BufferContentType> = {
  contentType: TBufferContentType;
}
type LayoutBufferDetail = HasBufferContentType<'layout'> & {
  layout: NonEmptyArray<WGBKElementLayout>;
};
type MarshalledBufferDetail<TFormat extends WGBKInstanceFormat> = HasBufferContentType<'marshalled'> & {
  marshall: WGBKMarshalledFormat<TFormat>;
};

export enum WGBKBufferUsage {
  STORAGE = GPUBufferUsage.STORAGE,
  STORAGE_VERTEX = GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
  VERTEX = GPUBufferUsage.VERTEX,
}
export type WGBKBufferType = 'uniform' | 'entity';
type HasBufferType<TType extends WGBKBufferType> = {
  bufferType: TType;
};
export type WGBKBufferFormat<TBufferType extends WGBKBufferType, TBufferContentType extends BufferContentType> = HasBufferType<TBufferType> & HasBufferContentType<TBufferContentType>;
export type WGBKUniformBufferFormat<TFormat extends WGBKInstanceFormat> = HasBufferType<'uniform'> & MarshalledBufferDetail<TFormat>;
export type WGBKEntityBufferFormat<TFormat extends WGBKInstanceFormat> = HasBufferType<'entity'> & (LayoutBufferDetail | MarshalledBufferDetail<TFormat>);
export type WGBKEntityBufferFormats<TEntityFormat extends WGBKInstanceFormat> = Record<string, WGBKEntityBufferFormat<TEntityFormat>>;
export type WGBKBufferFormats<TUniformFormat extends WGBKInstanceFormat, TEntityFormat extends WGBKInstanceFormat> = Record<string, WGBKUniformBufferFormat<TUniformFormat> | WGBKEntityBufferFormat<TEntityFormat>>;
export type WGBKBufferFormatKey<TBufferFormats extends WGBKBufferFormats<any, any>> = string & (keyof TBufferFormats);

export type WGBKTrackedBuffer = {
  isNew: boolean;
  buffer: GPUBuffer;
  destroy: () => void;
};
export type WGBKResource<T> = {
  get: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder) => T;
};

export type WGBKMutateUniform<TFormat extends WGBKInstanceFormat> = {
  mutateUniform: (uniform: WGBKInstanceOf<TFormat>) => void;
};
export type WGBKResizeInstances<TFormat extends WGBKInstanceFormat> = {
  add: (instance: WGBKInstanceOf<TFormat>) => string;
  remove: (instanceId: string) => void;
};
export type WGBKMutateByIndex<TFormat extends WGBKInstanceFormat> = {
  mutateInstanceByIndex: (index: number, instance: WGBKInstanceOf<TFormat>) => void;
};
export type WGBKMutateById<TFormat extends WGBKInstanceFormat> = {
  mutateInstanceById: (id: string, instance: WGBKInstanceOf<TFormat>) => void;
};

export type WGBKMutableOptions<TMutableUniform extends boolean, TMutableInstances extends boolean, TResizeableInstances extends boolean> = {
  isMutableUniform: TMutableUniform;
  isMutableInstances: TMutableInstances;
  isResizeableInstances: TResizeableInstances;
};
export type WGBKBufferResources<TUniformFormat extends WGBKInstanceFormat, TEntityFormat extends WGBKInstanceFormat, TBufferFormats extends WGBKBufferFormats<TUniformFormat, TEntityFormat>, TMutableUniforms extends boolean, TMutableInstances extends boolean, TResizeableInstances extends boolean> = {
  buffers: Record<WGBKBufferFormatKey<TBufferFormats>, WGBKResource<WGBKTrackedBuffer>>;
  instanceCount: () => number;
  update: () => void;
}
  & (TMutableUniforms extends true
    ? WGBKMutateUniform<TUniformFormat>
    : object
  )
  & (TMutableInstances extends true
    ? TResizeableInstances extends true
    ? WGBKMutateById<TEntityFormat>
    : WGBKMutateByIndex<TEntityFormat>
    : object
  )
  & (TResizeableInstances extends true
    ? WGBKResizeInstances<TEntityFormat>
    : object
  );

type WGBKHasBufferRef<K> = {
  buffer: K & string;
};
type WGBKBufferRefOf<
  TBufferFormats extends WGBKBufferFormats<any, any>,
  TBufferType extends WGBKBufferType,
  TContentType extends BufferContentType,
> = {
  [K in keyof TBufferFormats]: TBufferFormats[K]['bufferType'] extends TBufferType
  ? TBufferFormats[K]['contentType'] extends TContentType
  ? WGBKHasBufferRef<K>
  : never
  : never
}[keyof TBufferFormats];
export type WGBKUniformBufferKeys<TBufferFormats extends WGBKBufferFormats<any, any>> = WGBKBufferRefOf<TBufferFormats, 'uniform', any>;
export type WGBKInstanceLayoutBufferKeys<TBufferFormats extends WGBKBufferFormats<any, any>> = WGBKBufferRefOf<TBufferFormats, 'entity', 'layout'>;
export type WGBKInstanceMarshalledBufferKeys<TBufferFormats extends WGBKBufferFormats<any, any>> = WGBKBufferRefOf<TBufferFormats, 'entity', 'marshalled'>;

export type WGBKMeshBufferResource = {
  indices: WGBKResource<WGBKTrackedBuffer>;
  vertices: WGBKResource<WGBKTrackedBuffer>;
};
