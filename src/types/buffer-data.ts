import { WPKBufferFormatKey, WPKBufferFormatMap, WPKStructType, WPKHasStructType } from './buffer-formats';
import { WPKShaderDatumType } from './structs';

//#region bridge
export type WPKRefPath = Array<(string | number)>;
export type WPKDatumExtractor<T, TValue> = (instance: T) => TValue;
export type WPKDatumExtractEmbedder<T, TValue> = {
  extract: (instance: T) => TValue;
  embed: (instance: Record<string, any>, value: TValue) => void;
};
export type WPKDatumGetterFunc = (target: DataView, offset: number, littleEndian: boolean) => number;
export type WPKDatumSetterFunc = (target: DataView, offset: number, value: number, littleEndian: boolean) => void;
export type WPKDatumGetSetter = {
  stride: number;
  get: WPKDatumGetterFunc;
  set: WPKDatumSetterFunc;
};
export type WPKDatumBridgeFunc<T> = (offset: number, instance: T, dataView: DataView) => void;
export type WPKDatumBridgeEditable = {
  stride: number;
  dataViewToInstance: WPKDatumBridgeFunc<Record<string, any>>;
};
export type WPKDatumBridgeMarshalled<T> = WPKDatumBridgeEditable & {
  instanceToDataView: WPKDatumBridgeFunc<T>;
};
export type WPKDatumBridge<T> =
  | WPKDatumBridgeEditable
  | WPKDatumBridgeMarshalled<T>
  ;
//#endregion

//#region layout
export type WPKDatumSizes = {
  alignment: number;
  reserved: number;
};
export type WPKNamedDatumTypeAlignment = {
  name: string;
  datumType: WPKShaderDatumType;
  datumAlignment: WPKDatumSizes;
};
export type WPKBufferLayoutEntry<TBridge extends WPKDatumBridge<any>> = {
  datumType: WPKShaderDatumType;
  bridge: TBridge;
  offset: number;
  reserved: number;
};
export type WPKStructLayout<TStructType extends WPKStructType, TEntry> = WPKHasStructType<TStructType> & {
  entries: Record<string, TEntry>;
};
export type WPKBufferLayoutBase<TStructType extends WPKStructType, TBridge extends WPKDatumBridge<any>> = WPKStructLayout<TStructType, WPKBufferLayoutEntry<TBridge>> & {
  stride: number;
  usage: GPUBufferUsageFlags;
};
export type WPKBufferLayoutUniform<TUniform> = WPKBufferLayoutBase<'uniform', WPKDatumBridgeMarshalled<TUniform>>;
export type WPKBufferLayoutMarshalled<TEntity> = WPKBufferLayoutBase<'marshalled', WPKDatumBridgeMarshalled<TEntity>>;
export type WPKBufferLayoutEditable = WPKBufferLayoutBase<'editable', WPKDatumBridgeEditable>;
export type WPKBufferLayoutVaryings = WPKStructLayout<'varyings', WPKShaderDatumType>;
export type WPKBufferLayout<TUniform, TEntity> =
  | WPKBufferLayoutUniform<TUniform>
  | WPKBufferLayoutEditable
  | WPKBufferLayoutMarshalled<TEntity>
  | WPKBufferLayoutVaryings
  ;
export type WPKBufferLayouts<TUniform, TEntity> = Record<string, WPKBufferLayout<TUniform, TEntity>>;
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
  update: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder) => void;
  get: () => T;
  clean: () => void;
};
export type WPKMeshBufferResource = {
  indices: WPKResource<WPKTrackedBuffer>;
  vertices: WPKResource<WPKTrackedBuffer>;
};
export type WPKBufferResources<TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>> = {
  buffers: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap, any, any>, WPKResource<WPKTrackedBuffer>>;
  instanceCount: () => number;
  update: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder) => void;
};
//#endregion

//#region dispatch
export const DISPATCH_PARAMS_BUFFER_NAME = 'dispatch';
export type WPKDispatchCount = [number, number, number];
export type WPKDispatchCounts<TEntryPoints extends string[]> = {
  [K in TEntryPoints[number]]: WPKDispatchCount;
};
export type WPKDispatchParams = {
  instanceCount: number;
};
export type WPKDispatchParamsDetail<TEntryPoints extends string[]> = WPKDispatchParams & {
  dispatchCounts: WPKDispatchCounts<TEntryPoints>;
};
export type WPKDispatchResource<TEntryPoints extends string[]> = {
  layout: WPKBufferLayoutUniform<WPKDispatchParamsDetail<TEntryPoints>>;
  buffer: WPKResource<WPKTrackedBuffer>;
  params: WPKResource<WPKDispatchParamsDetail<TEntryPoints>>;
};
//#endregion
