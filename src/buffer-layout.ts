import { datumBridgeFactory } from './datum-bridge';
import { getLogger } from './logging';
import { WPKShaderDatumType, WPKDatumSizes, WPKBufferLayoutEditable, WPKBufferLayoutEntry, WPKNamedDatumTypeAlignment, WPKBufferFormatMap, WPKBufferLayouts, WPKStructType, WPKEntityCache, WPKBufferLayoutUniform, WPKBufferLayoutMarshalled, WPKBufferFormatElementUniform, WPKBufferFormatElementStorage, WPKBufferLayoutBase, WPKHasDatumType, WPKDatumBridge, WPKBufferLayoutVaryings } from './types';
import { logFuncs, recordFuncs } from './utils';

const LOGGER = getLogger('pipeline');

export const bufferLayoutsFuncs = {
  toBufferLayouts: <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
    bufferFormatMap: TBufferFormatMap,
    entityCache: WPKEntityCache<TEntity, any, any>,
    isBufferBound: (bufferName: string) => boolean,
    isVertexBuffer: (bufferName: string) => boolean,
  ): WPKBufferLayouts<TUniform, TEntity> => {
    const layouts: WPKBufferLayouts<TUniform, TEntity> = {};
    for (const [bufferName, bufferFormat] of Object.entries(bufferFormatMap)) {
      const { structType } = bufferFormat;
      const isBinding = isBufferBound(bufferName);
      const isVertex = isVertexBuffer(bufferName);
      const usage = toBufferUsage(structType, bufferName, isBinding, isVertex);
      if (structType === 'uniform') {
        layouts[bufferName] = bufferLayoutsFuncs.toBufferLayoutUniform(bufferFormat.marshall, usage);
      } else if (structType === 'editable') {
        layouts[bufferName] = bufferLayoutsFuncs.toBufferLayoutEditable(bufferFormat.layout, usage);
      } else if (structType === 'marshalled') {
        layouts[bufferName] = bufferLayoutsFuncs.toBufferLayoutMarshalled(bufferFormat.marshall, usage, entityCache);
      } else if (structType === 'varyings') {
        layouts[bufferName] = bufferLayoutsFuncs.toBufferLayoutVaryings(bufferFormat.varyings);
      }
    }
    return layouts;
  },
  toBufferLayoutUniform: <TUniform>(
    elements: Record<string, WPKBufferFormatElementUniform<TUniform>>,
    usage: GPUBufferUsageFlags,
  ): WPKBufferLayoutUniform<TUniform> => {
    return toBufferLayout('uniform', elements, usage, (namedDatumType, offset) => datumBridgeFactory.ofFormatElement(elements[namedDatumType.name], offset));
  },
  toBufferLayoutEditable: (
    elements: Record<string, WPKHasDatumType>,
    usage: GPUBufferUsageFlags
  ): WPKBufferLayoutEditable => {
    return toBufferLayout('editable', elements, usage, (namedDatumType, offset) => datumBridgeFactory.ofDatumType(namedDatumType.name, namedDatumType.datumType, offset));
  },
  toBufferLayoutMarshalled: <TEntity>(
    elements: Record<string, WPKBufferFormatElementStorage<TEntity>>,
    usage: GPUBufferUsageFlags,
    entityCache?: WPKEntityCache<TEntity, any, any>
  ): WPKBufferLayoutMarshalled<TEntity> => {
    return toBufferLayout('marshalled', elements, usage, (namedDatumType, offset) => datumBridgeFactory.ofFormatElement(elements[namedDatumType.name], offset, entityCache));
  },
  toBufferLayoutVaryings: (
    elements: Record<string, WPKShaderDatumType>,
  ): WPKBufferLayoutVaryings => {
    return {
      structType: 'varyings',
      entries: elements,
    };
  },
};

const toBufferUsage = (structType: WPKStructType, bufferName: string, isBinding: boolean, isVertex: boolean): GPUBufferUsageFlags => {
  let usage = 0;
  if (structType === 'uniform') {
    if (isBinding) {
      usage |= GPUBufferUsage.UNIFORM;
    }
  } else {
    if (isBinding) {
      usage |= GPUBufferUsage.STORAGE;
    }
    if (isVertex) {
      usage |= GPUBufferUsage.VERTEX;
    }
  }
  if (usage === 0) {
    logFuncs.lazyWarn(LOGGER, () => `Buffer ${bufferName} isn't used`);
  }
  return usage;
};

const namedDatumTypeComparator = (a: WPKNamedDatumTypeAlignment, b: WPKNamedDatumTypeAlignment): number => {
  const { datumAlignment: datumAlignmentA, name: nameA } = a;
  const { datumAlignment: datumAlignmentB, name: nameB } = b;
  if (datumAlignmentA.alignment !== datumAlignmentB.alignment) {
    return datumAlignmentB.alignment - datumAlignmentA.alignment;
  }
  if (datumAlignmentA.reserved !== datumAlignmentB.reserved) {
    return datumAlignmentB.reserved - datumAlignmentA.reserved;
  }
  return nameA.localeCompare(nameB);
};

const typeAlignments: Record<WPKShaderDatumType, WPKDatumSizes> = {
  'f32': { alignment: 4, reserved: 4 },
  'i32': { alignment: 4, reserved: 4 },
  'u32': { alignment: 4, reserved: 4 },
  'vec2<f32>': { alignment: 8, reserved: 8 },
  'vec2<i32>': { alignment: 8, reserved: 8 },
  'vec2<u32>': { alignment: 8, reserved: 8 },
  'vec3<f32>': { alignment: 16, reserved: 16 },
  'vec3<i32>': { alignment: 16, reserved: 16 },
  'vec3<u32>': { alignment: 16, reserved: 16 },
  'vec4<i32>': { alignment: 16, reserved: 16 },
  'vec4<f32>': { alignment: 16, reserved: 16 },
  'vec4<u32>': { alignment: 16, reserved: 16 },
  'mat2x2<f32>': { alignment: 8, reserved: 16 },
  'mat2x3<f32>': { alignment: 16, reserved: 32 },
  'mat2x4<f32>': { alignment: 16, reserved: 32 },
  'mat3x2<f32>': { alignment: 8, reserved: 24 },
  'mat3x3<f32>': { alignment: 16, reserved: 48 },
  'mat3x4<f32>': { alignment: 16, reserved: 48 },
  'mat4x2<f32>': { alignment: 8, reserved: 32 },
  'mat4x3<f32>': { alignment: 16, reserved: 64 },
  'mat4x4<f32>': { alignment: 16, reserved: 64 },
};

type WPKToBridge<TBridge extends WPKDatumBridge<any>> = (namedDatumType: WPKNamedDatumTypeAlignment, offset: number) => TBridge;

const toBufferLayout = <T, TStructType extends WPKStructType, TBridge extends WPKDatumBridge<T>>(
  structType: TStructType,
  elements: Record<string, WPKHasDatumType>,
  usage: GPUBufferUsageFlags,
  toBridge: WPKToBridge<TBridge>,
): WPKBufferLayoutBase<TStructType, TBridge> => {
  const namedDatumTypeAlignments: WPKNamedDatumTypeAlignment[] = recordFuncs.toArray(elements, (entry, name): WPKNamedDatumTypeAlignment => ({
    name,
    datumType: entry.datumType,
    datumAlignment: typeAlignments[entry.datumType],
  }))
    .filter(type => type.datumAlignment !== undefined)
    .sort(namedDatumTypeComparator);
  const entries: Record<string, WPKBufferLayoutEntry<TBridge>> = {};
  let offset = 0;
  for (const namedDatumType of namedDatumTypeAlignments) {
    const { datumType, datumAlignment: { reserved }, name } = namedDatumType;
    const bridge = toBridge(namedDatumType, offset);
    entries[name] = {
      datumType,
      bridge,
      offset,
      reserved,
    };
    offset += reserved;
  }
  const maxAlignment = namedDatumTypeAlignments[0].datumAlignment.alignment;
  const stride = Math.ceil(offset / maxAlignment) * maxAlignment;
  return {
    structType,
    entries,
    stride,
    usage,
  };
};
