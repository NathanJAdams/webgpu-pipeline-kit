import { WPKBufferFormat, WPKBufferFormatKey, WPKBufferFormatMap } from './buffer-formats';

//#region bridge
export type WPKRefPath = Array<(string | number)>;
export type WPKDatumExtractor<T, TValue> = (instance: T) => TValue;
export type WPKDatumExtractEmbedder<T, TValue> = {
  extract: (instance: T) => TValue;
  embed: (instance: T, value: TValue) => void;
};
export type WPKDatumBridge<T> = {
  stride: number;
  instanceToDataView: WPKDatumBridgeFunc<T>;
  dataViewToInstance: WPKDatumBridgeFunc<T>;
};
export type WPKDatumBridgeFunc<T> = (offset: number, instance: T, dataView: DataView) => void;
export type WPKDatumGetterFunc = (target: DataView, offset: number, littleEndian: boolean) => number;
export type WPKDatumSetterFunc = (target: DataView, offset: number, value: number, littleEndian: boolean) => void;
export type WPKDatumGetSetter = {
  stride: number;
  get: WPKDatumGetterFunc;
  set: WPKDatumSetterFunc;
};
//#endregion

//#region mutate
export type WPKMarshaller<T> = {
  encode: (instances: T[]) => ArrayBuffer;
};
export type WPKMutator<T> = {
  mutate: (input: T) => void;
};
export type WPKMutatedData = {
  data: ArrayBuffer;
  index: number;
};
export type WPKBufferMutable<T> = {
  mutate: (data: ArrayBuffer, target: T) => void;
};
export type WPKBufferResizeable = {
  resize: (bytesLength: number) => void;
};
//#endregion

//#region resources
export type WPKTrackedBuffer = {
  isNew: boolean;
  bytesLength: number;
  buffer: GPUBuffer;
  destroy: () => void;
};
export type WPKResource<T> = {
  get: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder) => T;
};
export type WPKMeshBufferResource = {
  indices: WPKResource<WPKTrackedBuffer>;
  vertices: WPKResource<WPKTrackedBuffer>;
};
export type WPKBufferResources<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  buffers: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>, WPKResource<WPKTrackedBuffer>>;
  instanceCount: () => number;
  update: () => void;
};
//#endregion

//#region dispatch
export const DISPATCH_PARAMS_BUFFER_NAME = 'dispatch';
export type WPKDispatchSize = [number, number, number];
export type WPKDispatchSizes<TEntryPoints extends string[]> = {
  [K in TEntryPoints[number]]: WPKDispatchSize;
};
export type WPKDispatchParams<TEntryPoints extends string[]> = {
  instanceCount: number;
  dispatchSizes: WPKDispatchSizes<TEntryPoints>;
};
export type WPKDispatchResource<TEntryPoints extends string[]> = {
  format: WPKBufferFormat<WPKDispatchParams<TEntryPoints>, any>;
  buffer: WPKResource<WPKTrackedBuffer>;
  params: WPKResource<WPKDispatchParams<TEntryPoints>>;
};
//#endregion
