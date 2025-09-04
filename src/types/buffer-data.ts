import { WPKBufferFormatKey, WPKBufferFormatMap } from './buffer-formats';

//#region bridge
export type WPKRefPath = Array<(string | number)>;
export type WPKDatumExtractor<T, TValue> = (instance: T) => TValue;
export type WPKDatumBridge<T> = {
  stride: number;
  bridge: WPKDatumBridgeFunc<T>;
};
export type WPKDatumBridgeFunc<T> = (offset: number, instance: T, dataView: DataView) => void;
export type WPKDatumSetterFunc = (target: DataView, offset: number, value: number, littleEndian: boolean) => void;
export type WPKDatumSetter = {
  stride: number;
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
  buffers: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, boolean>, WPKResource<WPKTrackedBuffer>>;
  instanceCount: () => number;
  update: () => void;
};
//#endregion
