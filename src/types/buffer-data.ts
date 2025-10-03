import { WPKBufferFormatKey, WPKBufferFormatMap, WPKBufferFormatType, WPKHasBufferFormatType } from './buffer-formats';
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
export type WPKBufferLayoutBase<TBridge extends WPKDatumBridge<any>, TBufferType extends WPKBufferFormatType> = WPKHasBufferFormatType<TBufferType> & {
  stride: number;
  usage: GPUBufferUsageFlags;
  entries: Record<string, WPKBufferLayoutEntry<TBridge>>;
};
export type WPKBufferLayoutUniform<TUniform> = WPKBufferLayoutBase<WPKDatumBridgeMarshalled<TUniform>, 'uniform'>;
export type WPKBufferLayoutMarshalled<TEntity> = WPKBufferLayoutBase<WPKDatumBridgeMarshalled<TEntity>, 'marshalled'>;
export type WPKBufferLayoutEditable = WPKBufferLayoutBase<WPKDatumBridgeEditable, 'editable'>;
export type WPKBufferLayout<TUniform, TEntity> =
  | WPKBufferLayoutUniform<TUniform>
  | WPKBufferLayoutEditable
  | WPKBufferLayoutMarshalled<TEntity>
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
  get: (device: GPUDevice, queue: GPUQueue, encoder: GPUCommandEncoder) => T;
  clean: () => void;
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
