import { WPKInstanceFormat, WPKInstanceOf } from './instance-types';
import { ArrayIndex, ExactlyOne, NonEmptyArray, TupleOf } from './utils';

type WPKByteSimpleVertexFormat = 'sint8' | 'snorm8' | 'uint8' | 'unorm8';
type WPKHalfSimpleVertexFormat = 'sint16' | 'snorm16' | 'uint16' | 'unorm16' | 'float16';
type WPKFullSimpleVertexFormat = 'sint32' | 'uint32' | 'float32';
export type WPKSimpleVertexFormat = WPKByteSimpleVertexFormat | WPKHalfSimpleVertexFormat | WPKFullSimpleVertexFormat;

export type WPKFormatRef<T0, T1 = undefined> = {
  ref_0: T0;
} & (T1 extends undefined
  ? object
  : {
    ref_1: T1;
  });
export type WPKScalarFormatReference<TFormat extends WPKInstanceFormat> = {
  [K in keyof TFormat]: TFormat[K] extends 'scalar'
  ? WPKFormatRef<K>
  : never
}[keyof TFormat];
export type WPKTupleFormatReference<TFormat extends WPKInstanceFormat> = {
  [K in keyof TFormat]: TFormat[K] extends number
  ? WPKFormatRef<K, ArrayIndex<TFormat[K]>>
  : never
}[keyof TFormat];
export type WPKNamedFormatReference<TFormat extends WPKInstanceFormat> = {
  [K in keyof TFormat]: TFormat[K] extends readonly string[]
  ? WPKFormatRef<K, TFormat[K][number]>
  : never
}[keyof TFormat];
export type WPKFormatReference<TFormat extends WPKInstanceFormat> =
  | WPKScalarFormatReference<TFormat>
  | WPKTupleFormatReference<TFormat>
  | WPKNamedFormatReference<TFormat>
  ;

export type WPKMarshalledFormatElementBase<TDatumType extends WPKSimpleVertexFormat> = {
  datumType: TDatumType;
};
type WPKHasScalar<TFormat extends WPKInstanceFormat> = {
  scalar: WPKFormatReference<TFormat>;
};
type WPKHasVec<TFormat extends WPKInstanceFormat, TVecLength extends number> = {
  vec: TupleOf<WPKFormatReference<TFormat>, TVecLength>;
};
export type WPKHasScalarXorVec<TFormat extends WPKInstanceFormat, TVecLength extends number | undefined = undefined> = ExactlyOne<
  WPKHasScalar<TFormat>
  & (TVecLength extends number
    ? WPKHasVec<TFormat, TVecLength>
    : object
  )
>;
type WPKMarshalledSimpleVecFormatElement<TFormat extends WPKInstanceFormat> = WPKMarshalledFormatElementBase<WPKByteSimpleVertexFormat | WPKHalfSimpleVertexFormat | WPKFullSimpleVertexFormat> & WPKHasScalarXorVec<TFormat, 2 | 4>;
type WPKMarshalledFullFormatElement<TFormat extends WPKInstanceFormat> = WPKMarshalledFormatElementBase<WPKFullSimpleVertexFormat> & WPKHasScalarXorVec<TFormat, 3>;
export type WPKMarshalledFormatElement<TFormat extends WPKInstanceFormat> =
  | WPKMarshalledSimpleVecFormatElement<TFormat>
  | WPKMarshalledFullFormatElement<TFormat>
  ;
export type WPKMarshalledFormat<TFormat extends WPKInstanceFormat> = NonEmptyArray<WPKMarshalledFormatElement<TFormat>>;

type WPKElementLayoutBase<TDatumType extends WPKSimpleVertexFormat> = {
  datumType: TDatumType;
};
type WPKScalarElementLayout = WPKElementLayoutBase<WPKSimpleVertexFormat> & {
  dimension: 'scalar';
};
type WPKSimpleVecElementLayout = WPKElementLayoutBase<WPKSimpleVertexFormat> & {
  dimension: 'vec2' | 'vec4';
};
type WPKFullElementLayout = WPKElementLayoutBase<WPKFullSimpleVertexFormat> & {
  dimension: 'vec2' | 'vec3' | 'vec4';
};
export type WPKElementLayout =
  | WPKScalarElementLayout
  | WPKSimpleVecElementLayout
  | WPKFullElementLayout
  ;

export type WPKBufferContentType = 'layout' | 'marshalled';
type WPKHasBufferContentType<TBufferContentType extends WPKBufferContentType> = {
  contentType: TBufferContentType;
}
type WPKLayoutBufferDetail = WPKHasBufferContentType<'layout'> & {
  layout: NonEmptyArray<WPKElementLayout>;
};
type WPKMarshalledBufferDetail<TFormat extends WPKInstanceFormat> = WPKHasBufferContentType<'marshalled'> & {
  marshall: WPKMarshalledFormat<TFormat>;
};

export enum WPKBufferUsage {
  STORAGE = GPUBufferUsage.STORAGE,
  STORAGE_VERTEX = GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
  VERTEX = GPUBufferUsage.VERTEX,
}
export type WPKBufferType = 'uniform' | 'entity';
type WPKHasBufferType<TType extends WPKBufferType> = {
  bufferType: TType;
};
export type WPKBufferFormat<TBufferType extends WPKBufferType, TBufferContentType extends WPKBufferContentType> = WPKHasBufferType<TBufferType> & WPKHasBufferContentType<TBufferContentType>;
export type WPKUniformBufferFormat<TFormat extends WPKInstanceFormat> = WPKHasBufferType<'uniform'> & WPKMarshalledBufferDetail<TFormat>;
export type WPKEntityBufferFormat<TFormat extends WPKInstanceFormat> = WPKHasBufferType<'entity'> & (WPKLayoutBufferDetail | WPKMarshalledBufferDetail<TFormat>);
export type WPKEntityBufferFormats<TEntityFormat extends WPKInstanceFormat> = Record<string, WPKEntityBufferFormat<TEntityFormat>>;
export type WPKBufferFormats<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat> = Record<string, WPKUniformBufferFormat<TUniformFormat> | WPKEntityBufferFormat<TEntityFormat>>;
export type WPKBufferFormatKey<TBufferFormats extends WPKBufferFormats<any, any>> = string & (keyof TBufferFormats);

export type WPKTrackedBuffer = {
  isNew: boolean;
  buffer: GPUBuffer;
  destroy: () => void;
};
export type WPKResource<T> = {
  get: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder) => T;
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
export type WPKBufferResources<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormats<TUniformFormat, TEntityFormat>, TMutableUniforms extends boolean, TMutableInstances extends boolean, TResizeableInstances extends boolean> = {
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

type WPKHasBufferRef<K> = {
  buffer: K & string;
};
type WPKBufferRefOf<
  TBufferFormats extends WPKBufferFormats<any, any>,
  TBufferType extends WPKBufferType,
  TContentType extends WPKBufferContentType,
> = {
  [K in keyof TBufferFormats]: TBufferFormats[K]['bufferType'] extends TBufferType
  ? TBufferFormats[K]['contentType'] extends TContentType
  ? WPKHasBufferRef<K>
  : never
  : never
}[keyof TBufferFormats];
export type WPKUniformBufferKeys<TBufferFormats extends WPKBufferFormats<any, any>> = WPKBufferRefOf<TBufferFormats, 'uniform', any>;
export type WPKInstanceLayoutBufferKeys<TBufferFormats extends WPKBufferFormats<any, any>> = WPKBufferRefOf<TBufferFormats, 'entity', 'layout'>;
export type WPKInstanceMarshalledBufferKeys<TBufferFormats extends WPKBufferFormats<any, any>> = WPKBufferRefOf<TBufferFormats, 'entity', 'marshalled'>;

export type WPKMeshBufferResource = {
  indices: WPKResource<WPKTrackedBuffer>;
  vertices: WPKResource<WPKTrackedBuffer>;
};
