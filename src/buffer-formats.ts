import { WPKEntityCache } from './cache';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { WPKMatchingPath } from './matching-path';
import { NonEmptyArray } from './utils';

type WPKPrimitive8 = 'sint8' | 'snorm8' | 'uint8' | 'unorm8';
type WPKPrimitive16 = 'sint16' | 'snorm16' | 'uint16' | 'unorm16' | 'float16';
type WPKPrimitive32 = 'sint32' | 'uint32' | 'float32';
type WPKPrimitiveSignedInt = 'sint8' | 'sint16' | 'sint32';
export type WPKPrimitive = WPKPrimitive8 | WPKPrimitive16 | WPKPrimitive32;

type WPKMatchingPathScalar<TFormat extends WPKInstanceFormat> = WPKMatchingPath<WPKInstanceOf<TFormat>, number>;
type WPKMatchingPathVec2<TFormat extends WPKInstanceFormat> = WPKMatchingPath<WPKInstanceOf<TFormat>, [number, number]>;
type WPKMatchingPathVec3<TFormat extends WPKInstanceFormat> = WPKMatchingPath<WPKInstanceOf<TFormat>, [number, number, number]>;
type WPKMatchingPathVec4<TFormat extends WPKInstanceFormat> = WPKMatchingPath<WPKInstanceOf<TFormat>, [number, number, number, number]>;

type WPKDatumType<TDatumType = WPKPrimitive> = {
  datumType: TDatumType;
};

type WPKLayoutTypes<TDimension, TDatumType = WPKPrimitive> = WPKDatumType<TDatumType> & {
  dimension: TDimension;
};
type WPKLayoutScalar = WPKLayoutTypes<'scalar'>;
type WPKLayoutVec2 = WPKLayoutTypes<'vec2'>;
type WPKLayoutVec3 = WPKLayoutTypes<'vec3', WPKPrimitive32>;
type WPKLayoutVec4 = WPKLayoutTypes<'vec4'>;
export type WPKLayout = WPKLayoutScalar | WPKLayoutVec2 | WPKLayoutVec3 | WPKLayoutVec4;

type WPKPathScalar<TFormat extends WPKInstanceFormat> = WPKMatchingPathScalar<TFormat>;
type WPKPathVec2<TFormat extends WPKInstanceFormat> =
  | WPKMatchingPathVec2<TFormat>
  | [
    WPKMatchingPathScalar<TFormat>,
    WPKMatchingPathScalar<TFormat>,
  ];
type WPKPathVec3<TFormat extends WPKInstanceFormat> =
  | WPKMatchingPathVec3<TFormat>
  | [
    WPKMatchingPathScalar<TFormat>,
    WPKMatchingPathScalar<TFormat>,
    WPKMatchingPathScalar<TFormat>,
  ];
type WPKPathVec4<TFormat extends WPKInstanceFormat> =
  | WPKMatchingPathVec4<TFormat>
  | [
    WPKMatchingPathScalar<TFormat>,
    WPKMatchingPathScalar<TFormat>,
    WPKMatchingPathScalar<TFormat>,
    WPKMatchingPathScalar<TFormat>,
  ];

export type WPKUserFormatScalar<TFormat extends WPKInstanceFormat> = WPKDatumType & {
  scalar: WPKPathScalar<TFormat>;
};
export type WPKUserFormatVec2<TFormat extends WPKInstanceFormat> = WPKDatumType & {
  vec2: WPKPathVec2<TFormat>;
};
export type WPKUserFormatVec3<TFormat extends WPKInstanceFormat> = WPKDatumType<WPKPrimitive32> & {
  vec3: WPKPathVec3<TFormat>;
};
export type WPKUserFormatVec4<TFormat extends WPKInstanceFormat> = WPKDatumType & {
  vec4: WPKPathVec4<TFormat>;
};
export type WPKUserFormatEntityIndex<TEntityFormat extends WPKInstanceFormat> = WPKDatumType<WPKPrimitiveSignedInt> & {
  entityIndexFromResizeableEntityCache: {
    key: WPKMatchingPath<WPKInstanceOf<TEntityFormat>, string>;
    target: WPKEntityCache<any, any, true>;
  };
};
export type WPKUserFormat<TFormat extends WPKInstanceFormat, TIsEntity extends boolean> =
  | WPKUserFormatScalar<TFormat>
  | WPKUserFormatVec2<TFormat>
  | WPKUserFormatVec3<TFormat>
  | WPKUserFormatVec4<TFormat>
  | (
    TIsEntity extends true
    ? WPKUserFormatEntityIndex<TFormat>
    : never
  );
export type WPKUserFormatRef<TFormat extends WPKInstanceFormat> = {
  datumCount: number;
  valuesOf: (instance: WPKInstanceOf<TFormat>) => number | number[];
};

export type WPKBufferType = 'uniform' | 'entity';
export type WPKContentType = 'layout' | 'marshalled';
export type WPKBufferTypes<TBufferType extends WPKBufferType, TContentType extends WPKContentType> = {
  bufferType: TBufferType;
  contentType: TContentType;
};

export type WPKFormatLayout = NonEmptyArray<WPKLayout>;
export type WPKFormatMarshall<TEntityFormat extends WPKInstanceFormat, TIsEntity extends boolean> = NonEmptyArray<WPKUserFormat<TEntityFormat, TIsEntity>>;

type WPKBufferDetailLayout = {
  layout: WPKFormatLayout;
};
type WPKBufferDetailMarshall<TEntityFormat extends WPKInstanceFormat, TIsEntity extends boolean> = {
  marshall: WPKFormatMarshall<TEntityFormat, TIsEntity>;
};

type WPKBufferFormatUniform<TUniformFormat extends WPKInstanceFormat> = WPKBufferTypes<'uniform', 'marshalled'> & WPKBufferDetailMarshall<TUniformFormat, false>;
type WPKBufferFormatEntityLayout = WPKBufferTypes<'entity', 'layout'> & WPKBufferDetailLayout;
type WPKBufferFormatEntityMarshalled<TEntityFormat extends WPKInstanceFormat> = WPKBufferTypes<'entity', 'marshalled'> & WPKBufferDetailMarshall<TEntityFormat, true>;
type WPKBufferFormatEntity<TEntityFormat extends WPKInstanceFormat> = WPKBufferFormatEntityLayout | WPKBufferFormatEntityMarshalled<TEntityFormat>;
type WPKBufferFormat<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat> =
  | WPKBufferFormatUniform<TUniformFormat>
  | WPKBufferFormatEntity<TEntityFormat>;
export type WPKBufferFormatMapEntity<TEntityFormat extends WPKInstanceFormat> = Record<string, WPKBufferFormatEntity<TEntityFormat>>;
export type WPKBufferFormatMap<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat> = Record<string, WPKBufferFormat<TUniformFormat, TEntityFormat>>;
export type WPKBufferFormatKeyEntity<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> =
  & string
  & {
    [K in keyof TBufferFormats]: TBufferFormats[K] extends WPKBufferFormatEntity<TEntityFormat> ? K : never
  }[keyof TBufferFormats];
export type WPKBufferFormatKey<TUniformFormat extends WPKInstanceFormat, TEntityFormat extends WPKInstanceFormat, TBufferFormats extends WPKBufferFormatMap<TUniformFormat, TEntityFormat>> = string & (keyof TBufferFormats);

export const isUserFormatScalar = <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TEntityFormat, any>): userFormat is WPKUserFormatScalar<TEntityFormat> => (userFormat as WPKUserFormatScalar<any>).scalar !== undefined;
export const isUserFormatVec2 = <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TEntityFormat, any>): userFormat is WPKUserFormatVec2<TEntityFormat> => (userFormat as WPKUserFormatVec2<any>).vec2 !== undefined;
export const isUserFormatVec3 = <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TEntityFormat, any>): userFormat is WPKUserFormatVec3<TEntityFormat> => (userFormat as WPKUserFormatVec3<any>).vec3 !== undefined;
export const isUserFormatVec4 = <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TEntityFormat, any>): userFormat is WPKUserFormatVec4<TEntityFormat> => (userFormat as WPKUserFormatVec4<any>).vec4 !== undefined;
export const isUserFormatEntityIndex = <TEntityFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TEntityFormat, any>): userFormat is WPKUserFormatEntityIndex<TEntityFormat> => (userFormat as WPKUserFormatEntityIndex<TEntityFormat>).entityIndexFromResizeableEntityCache !== undefined;
