import { logFactory } from './logging';
import { DISPATCH_PARAMS_STRUCT_CODE } from './shader-reserved';
import { WPKBufferFormat, WPKBufferFormatKey, WPKBufferFormatMap, WPKComputeCodeParams, WPKComputePass, WPKGroupBindings, WPKMeshTemplateMap, WPKRenderFragmentCodeParams, WPKRenderPass, WPKRenderPassFragment, WPKRenderPassVertex, WPKRenderVertexCodeParams, WPKShaderCompute, WPKShaderModuleDetail, WPKShaderRender } from './types';
import { logFuncs } from './utils';

const LOGGER = logFactory.getLogger('shader');

const WHITESPACE = '\n\n';

export const toCodeShaderCompute = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  shader: WPKShaderCompute<TUniform, TEntity, TBufferFormatMap>,
  bufferFormatMap: TBufferFormatMap
): WPKShaderModuleDetail => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating compute shader module detail');
  const { prologue, epilogue, groupBindings, passes } = shader;
  const structs = toCodeStructs(bufferFormatMap);
  const groupBindingsCode = toCodeGroupBindings(groupBindings, bufferFormatMap);
  const bindings = Object.keys(bufferFormatMap)
    .reduce((acc, key) => {
      acc[key as keyof TBufferFormatMap] = key;
      return acc;
    }, {} as Record<keyof TBufferFormatMap, string>);
  const computePassesCode = passes.map(pass => toCodeComputePass(pass, bindings));
  const entryPoints = passes.map(pass => pass.entryPoint);
  const code =
    structs
    + WHITESPACE
    + groupBindingsCode
    + WHITESPACE
    + DISPATCH_PARAMS_STRUCT_CODE
    + (prologue !== undefined ? WHITESPACE + prologue : '')
    + WHITESPACE
    + computePassesCode.join(WHITESPACE)
    + (epilogue !== undefined ? WHITESPACE + epilogue : '')
    + WHITESPACE
    ;
  return {
    code,
    entryPoints,
  };
};

export const toCodeShaderRender = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap>(
  shader: WPKShaderRender<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
  bufferFormatMap: TBufferFormatMap
): WPKShaderModuleDetail => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating render shader module detail');
  const { prologue, epilogue, groupBindings, passes } = shader;
  const structs = toCodeStructs(bufferFormatMap);
  const groupBindingsCode = toCodeGroupBindings(groupBindings, bufferFormatMap);
  const bindings = Object.keys(bufferFormatMap)
    .reduce((acc, key) => {
      acc[key as keyof TBufferFormatMap] = key;
      return acc;
    }, {} as Record<keyof TBufferFormatMap, string>);
  const renderPassesCode = passes.map(pass => toCodeRenderPass(pass, bindings));
  const entryPointsVertex = passes.map(pass => pass.vertex.entryPoint);
  const entryPointsFragment = passes.map(pass => pass.fragment.entryPoint);
  const entryPoints: string[] = [];
  entryPoints.push(...entryPointsVertex);
  entryPoints.push(...entryPointsFragment);
  const code =
    structs
    + WHITESPACE
    + groupBindingsCode
    + (prologue !== undefined ? WHITESPACE + prologue : '')
    + WHITESPACE
    + renderPassesCode.join(WHITESPACE)
    + (epilogue !== undefined ? WHITESPACE + epilogue : '')
    + WHITESPACE
    ;
  return {
    code,
    entryPoints,
  };
};

const toCodeStructs = (bufferMap: WPKBufferFormatMap<any, any>): string => {
  return Object.entries(bufferMap)
    .map(([name, bufferFormat]) => toCodeStruct(name, bufferFormat))
    .join(WHITESPACE);
};

const toCodeStruct = (structName: string, bufferFormat: WPKBufferFormat<any, any>): string => {
  const struct = (bufferFormat.bufferType === 'editable')
    ? bufferFormat.layout
    : bufferFormat.marshall;
  const lines = struct.map((entry) => `  ${entry.name} : ${entry.datumType};`);
  return `struct ${capitalize(structName)} {
${lines.join('\n')}
}`;
};

const toCodeGroupBindings = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  groupBindings: WPKGroupBindings<TUniform, TEntity, TBufferFormatMap>,
  bufferFormatMap: TBufferFormatMap
): string => {
  const entries = groupBindings.map((groupBinding) => {
    const { group, binding, buffer } = groupBinding;
    const bufferFormat = bufferFormatMap[buffer];
    const addressSpaceName = (bufferFormat.bufferType === 'uniform') ? 'uniform' : 'storage';
    const accessMode = (addressSpaceName === 'uniform')
      ? ''
      : (bufferFormat.bufferType === 'editable')
        ? ', read_write'
        : ', read';
    const dataType = (bufferFormat.bufferType === 'uniform')
      ? capitalize(buffer)
      : `array<${capitalize(buffer)}>`;
    return `@group(${group})\n@binding(${binding})\nvar<${addressSpaceName}${accessMode}> ${buffer} : ${dataType};`;
  });
  return entries.join(WHITESPACE);
};

const toCodeComputePass = <
  TUniform,
  TEntity,
  TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
>(pass: WPKComputePass<TUniform, TEntity, TBufferFormatMap>, bindings: Record<keyof TBufferFormatMap, string>): string => {
  const params: WPKComputeCodeParams<TUniform, TEntity, TBufferFormatMap> = {
    instance_index: 'instance_index',
    bindings,
  };
  return `
@compute
@workgroup_size(${pass.workGroupSize.x}, ${pass.workGroupSize.y || 1}, ${pass.workGroupSize.z || 1})
fn ${pass.entryPoint}(
  @builtin(global_invocation_id) global_invocation_id: vec3<u32>,
  @builtin(local_invocation_index) local_invocation_index: u32,
) {
  let instance_index: u32 =
  global_invocation_id.x
  + (global_invocation_id.y * DispatchParams.dispatch_size.x)
  + (global_invocation_id.z * DispatchParams.dispatch_size.x * DispatchParams.dispatch_size.y);
  if (instance_index >= DispatchParams.instance_count) {
    return;
  }
${pass.code(params)}
}`;
};

const toCodeRenderPass = <
  TUniform,
  TEntity,
  TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
  TMeshTemplateMap extends WPKMeshTemplateMap,
>(pass: WPKRenderPass<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>, bindings: Record<keyof TBufferFormatMap, string>): string => {
  const vertexPass = toCodeVertexPass(pass.vertex, bindings);
  const fragmentPass = toCodeFragmentPass(pass.fragment, bindings);
  return vertexPass
    + WHITESPACE
    + fragmentPass;
};

const toCodeVertexPass = <
  TUniform,
  TEntity,
  TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>,
>(pass: WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap>, bindings: Record<keyof TBufferFormatMap, string>): string => {
  const params: WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap> = {
    instance_index: 'instance_index',
    vertex_index: 'vertex_index',
    vertex_position: 'vertex_position',
    bindings,
  };
  return `@vertex
fn ${pass.entryPoint}(
  @builtin(instance_index) instance_index: u32,
  @builtin(vertex_index) vertex_index: u32,
  @location(0) vertex_position: vec4<f32>,
) -> @builtin(position) vec4<f32> {
${pass.code(params)}
}`;
};

const toCodeFragmentPass = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(pass: WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap>, bindings: Record<WPKBufferFormatKey<TUniform, TEntity, TBufferFormatMap>, string>): string => {
  const params: WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap> = {
    bindings,
    fragment_coordinate: 'fragment_coordinate',
  };
  return `@fragment
fn ${pass.entryPoint}(
  @builtin(position) fragment_coordinate: vec4<f32>,
) -> @location(0) vec4<f32> {
${pass.code(params)}
}`;
};

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.substring(1);
