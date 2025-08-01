import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { WPKMatchingPath } from './matching-path';
import { NonEmptyArray, stringFuncs } from './utils';

type WPKPrimitive8 = 'sint8' | 'snorm8' | 'uint8' | 'unorm8';
type WPKPrimitive16 = 'sint16' | 'snorm16' | 'uint16' | 'unorm16' | 'float16';
type WPKPrimitive32 = 'sint32' | 'uint32' | 'float32';
export type WPKPrimitive = WPKPrimitive8 | WPKPrimitive16 | WPKPrimitive32;

type WPKMatchingPathScalar<TInstanceFormat extends WPKInstanceFormat> = WPKMatchingPath<WPKInstanceOf<TInstanceFormat>, number>;
type WPKMatchingPathVec2<TInstanceFormat extends WPKInstanceFormat> = WPKMatchingPath<WPKInstanceOf<TInstanceFormat>, [number, number]>;
type WPKMatchingPathVec3<TInstanceFormat extends WPKInstanceFormat> = WPKMatchingPath<WPKInstanceOf<TInstanceFormat>, [number, number, number]>;
type WPKMatchingPathVec4<TInstanceFormat extends WPKInstanceFormat> = WPKMatchingPath<WPKInstanceOf<TInstanceFormat>, [number, number, number, number]>;

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

type WPKPathScalar<TInstanceFormat extends WPKInstanceFormat> = WPKMatchingPathScalar<TInstanceFormat>;
type WPKPathVec2<TInstanceFormat extends WPKInstanceFormat> =
  | WPKMatchingPathVec2<TInstanceFormat>
  | [
    WPKMatchingPathScalar<TInstanceFormat>,
    WPKMatchingPathScalar<TInstanceFormat>,
  ];
type WPKPathVec3<TInstanceFormat extends WPKInstanceFormat> =
  | WPKMatchingPathVec3<TInstanceFormat>
  | [
    WPKMatchingPathScalar<TInstanceFormat>,
    WPKMatchingPathScalar<TInstanceFormat>,
    WPKMatchingPathScalar<TInstanceFormat>,
  ];
type WPKPathVec4<TInstanceFormat extends WPKInstanceFormat> =
  | WPKMatchingPathVec4<TInstanceFormat>
  | [
    WPKMatchingPathScalar<TInstanceFormat>,
    WPKMatchingPathScalar<TInstanceFormat>,
    WPKMatchingPathScalar<TInstanceFormat>,
    WPKMatchingPathScalar<TInstanceFormat>,
  ];

type WPKUserFormatScalar<TInstanceFormat extends WPKInstanceFormat> = WPKDatumType & {
  scalar: WPKPathScalar<TInstanceFormat>;
};
type WPKUserFormatVec2<TInstanceFormat extends WPKInstanceFormat> = WPKDatumType & {
  vec2: WPKPathVec2<TInstanceFormat>;
};
type WPKUserFormatVec3<TInstanceFormat extends WPKInstanceFormat> = WPKDatumType<WPKPrimitive32> & {
  vec3: WPKPathVec3<TInstanceFormat>;
};
type WPKUserFormatVec4<TInstanceFormat extends WPKInstanceFormat> = WPKDatumType & {
  vec4: WPKPathVec4<TInstanceFormat>;
};
export type WPKUserFormat<TInstanceFormat extends WPKInstanceFormat> =
  | WPKUserFormatScalar<TInstanceFormat>
  | WPKUserFormatVec2<TInstanceFormat>
  | WPKUserFormatVec3<TInstanceFormat>
  | WPKUserFormatVec4<TInstanceFormat>;
type WPKUserFormatRef<TInstanceFormat extends WPKInstanceFormat> = {
  datumCount: number;
  valuesOf: (instance: WPKInstanceOf<TInstanceFormat>) => number | number[];
};

export type WPKBufferType = 'uniform' | 'entity';
export type WPKContentType = 'layout' | 'marshalled';
export type WPKBufferTypes<TBufferType extends WPKBufferType, TContentType extends WPKContentType> = {
  bufferType: TBufferType;
  contentType: TContentType;
};

export type WPKFormatLayout = NonEmptyArray<WPKLayout>;
export type WPKFormatMarshall<TInstanceFormat extends WPKInstanceFormat> = NonEmptyArray<WPKUserFormat<TInstanceFormat>>;

type WPKBufferDetailLayout = {
  layout: WPKFormatLayout;
};
type WPKBufferDetailMarshall<TInstanceFormat extends WPKInstanceFormat> = {
  marshall: WPKFormatMarshall<TInstanceFormat>;
};

type WPKBufferFormatUniform<TUniformFormat extends WPKInstanceFormat> = WPKBufferTypes<'uniform', 'marshalled'> & WPKBufferDetailMarshall<TUniformFormat>;
type WPKBufferFormatEntityLayout = WPKBufferTypes<'entity', 'layout'> & WPKBufferDetailLayout;
type WPKBufferFormatEntityMarshalled<TInstanceFormat extends WPKInstanceFormat> = WPKBufferTypes<'entity', 'marshalled'> & WPKBufferDetailMarshall<TInstanceFormat>;
type WPKBufferFormatEntity<TInstanceFormat extends WPKInstanceFormat> = WPKBufferFormatEntityLayout | WPKBufferFormatEntityMarshalled<TInstanceFormat>;
type WPKBufferFormat<TUniformFormat extends WPKInstanceFormat, TInstanceFormat extends WPKInstanceFormat> =
  | WPKBufferFormatUniform<TUniformFormat>
  | WPKBufferFormatEntity<TInstanceFormat>;
export type WPKBufferFormatMapEntity<TEntityFormat extends WPKInstanceFormat> = Record<string, WPKBufferFormatEntity<TEntityFormat>>;
export type WPKBufferFormatMap<TUniformFormat extends WPKInstanceFormat, TInstanceFormat extends WPKInstanceFormat> = Record<string, WPKBufferFormat<TUniformFormat, TInstanceFormat>>;
export type WPKBufferFormatKey<TBufferFormats extends WPKBufferFormatMap<any, any>> = string & (keyof TBufferFormats);

type WPKRefPath = Array<(string | number)>;
const toRefPath = (path: string): WPKRefPath => {
  const parts = path.split('.');
  return parts.map(part => stringFuncs.canBePositiveInt(part)
    ? Number(part)
    : part);
};
const valueAtPath = (input: any, refPath: WPKRefPath, pathIndex: number): unknown => {
  if (pathIndex > refPath.length) {
    throw Error(`Cannot use index ${pathIndex} larger than reference path. Path: ${refPath}. Input: ${JSON.stringify(input)}`);
  }
  if (pathIndex === refPath.length) {
    return input;
  }
  const indexValue = refPath[pathIndex];
  if (typeof input !== 'object' || input === null) {
    throw Error(`Cannot index field ${input} with index ${indexValue}. Path: ${refPath}. Input: ${JSON.stringify(input)}`);
  }
  if (typeof indexValue === 'string' || typeof indexValue === 'number') {
    return valueAtPath(input[indexValue], refPath, pathIndex + 1);
  }
  throw Error(`Cannot index using non-integer or string field ${indexValue}. Path: ${refPath}. Input: ${JSON.stringify(input)}`);
};
const valueOfInstanceAtPath = <TInstanceFormat extends WPKInstanceFormat>(instance: WPKInstanceOf<TInstanceFormat>, refPath: WPKRefPath): number => {
  const value = valueAtPath(instance, refPath, 0);
  if (typeof value === 'number') {
    return value;
  }
  throw Error(`Value ${JSON.stringify(value)} at path ${refPath} is not a number`);
};

const ofScalar = <TInstanceFormat extends WPKInstanceFormat>(path: string): WPKUserFormatRef<TInstanceFormat> => {
  const refPath = toRefPath(path);
  return {
    datumCount: 1,
    valuesOf: (instance) => valueOfInstanceAtPath(instance, refPath),
  };
};
const ofVecDirect = <TInstanceFormat extends WPKInstanceFormat>(path: string, vecLength: number): WPKUserFormatRef<TInstanceFormat> => {
  const refPath = toRefPath(path);
  return {
    datumCount: vecLength,
    valuesOf: (instance) => {
      const value = valueAtPath(instance, refPath, 0);
      if (Array.isArray(value)) {
        return value;
      }
      throw Error(`Value ${JSON.stringify(value)} at path ${refPath} is not an array`);
    },
  };
};
const ofVecSplit = <TInstanceFormat extends WPKInstanceFormat>(paths: string[]): WPKUserFormatRef<TInstanceFormat> => {
  const refPaths = paths.map(toRefPath);
  return {
    datumCount: paths.length,
    valuesOf: (instance) => refPaths.map(refPath => valueOfInstanceAtPath(instance, refPath)),
  };
};

export const isUserFormatScalar = <TInstanceFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TInstanceFormat>): userFormat is WPKUserFormatScalar<TInstanceFormat> => (userFormat as WPKUserFormatScalar<any>).scalar !== undefined;
export const isUserFormatVec2 = <TInstanceFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TInstanceFormat>): userFormat is WPKUserFormatVec2<TInstanceFormat> => (userFormat as WPKUserFormatVec2<any>).vec2 !== undefined;
export const isUserFormatVec3 = <TInstanceFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TInstanceFormat>): userFormat is WPKUserFormatVec3<TInstanceFormat> => (userFormat as WPKUserFormatVec3<any>).vec3 !== undefined;
export const isUserFormatVec4 = <TInstanceFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TInstanceFormat>): userFormat is WPKUserFormatVec4<TInstanceFormat> => (userFormat as WPKUserFormatVec4<any>).vec4 !== undefined;
export const toMarshalledRef = <TInstanceFormat extends WPKInstanceFormat>(userFormat: WPKUserFormat<TInstanceFormat>): WPKUserFormatRef<TInstanceFormat> => {
  if (isUserFormatScalar(userFormat)) {
    return ofScalar(userFormat.scalar);
  } else if (isUserFormatVec2(userFormat)) {
    return Array.isArray(userFormat.vec2)
      ? ofVecSplit(userFormat.vec2)
      : ofVecDirect(userFormat.vec2, 2);
  } else if (isUserFormatVec3(userFormat)) {
    return Array.isArray(userFormat.vec3)
      ? ofVecSplit(userFormat.vec3)
      : ofVecDirect(userFormat.vec3, 3);
  } else if (isUserFormatVec4(userFormat)) {
    return Array.isArray(userFormat.vec4)
      ? ofVecSplit(userFormat.vec4)
      : ofVecDirect(userFormat.vec4, 4);
  } else {
    throw Error(`Cannot create format reference from ${JSON.stringify(userFormat)}`);
  }
};
