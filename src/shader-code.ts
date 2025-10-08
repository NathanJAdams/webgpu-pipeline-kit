import { bufferLayoutsFuncs } from './buffer-layout';
import { getLogger } from './logging';
import { shaderReserved } from './shader-reserved';
import { shaderFuncs } from './shader-utils';
import { WPKBufferFormatMap, WPKComputeCodeParams, WPKComputePass, WPKGroupBinding, WPKMeshTemplateMap, WPKRenderFragmentCodeParams, WPKRenderPass, WPKRenderPassFragment, WPKRenderPassVertex, WPKRenderVertexCodeParams, WPKComputeShader, WPKShaderModuleDetail, WPKRenderShader, DISPATCH_PARAMS_BUFFER_NAME, WPKBufferBindingReferences, WPKVertexBufferReferences, WPKShaderDatumType, WPKScalarReference, WPKDatumTypeReferenceBase, WPKShaderScalarUnsignedInt, WPKShaderScalarSignedInt, WPKBufferLayout, WPKBufferLayouts, WPKBufferLayoutEntry, WPKVertexBufferFieldReferences, WPKVaryingsBufferFormat, WPKHasDatumType, WPKBufferLayoutVaryings, WPKDatumTypeReference, WPKVertexBufferAttributeData, WPKRenderVertexCodeParamsNoOutput, WPKRenderVertexCodeParamsOutput, WPKRenderFragmentCodeParamsInput, WPKRenderFragmentCodeParamsInputBuiltin, WPKRenderFragmentCodeParamsInputVaryings } from './types';
import { logFuncs } from './utils';

const LOGGER = getLogger('shader');

const WHITESPACE = '\n\n';
const BUFFER_INDEXING_VARIABLE = 'instance_index';

export const toCodeShaderCompute = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  shader: WPKComputeShader<TUniform, TEntity, TBufferFormatMap>,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>,
): WPKShaderModuleDetail => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating compute shader module detail');
  const { prologue, epilogue, groupBindings, passes } = shader;
  const entryPoints = passes.map(pass => pass.entryPoint);
  const dispatchLayout = bufferLayoutsFuncs.toBufferLayoutUniform(shaderReserved.DISPATCH_MARSHALLED_FORMAT, GPUBufferUsage.UNIFORM);
  const structs = toCodeStructs(bufferLayouts, false);
  const groupBindingsCode = toCodeGroupBindings(groupBindings, bufferLayouts);
  const bindings = toParamsBindings<TUniform, TEntity, TBufferFormatMap, true>(bufferLayouts, true);
  const computePassesCode = passes.map(pass => toCodeComputePass(pass, bindings));
  const code =
    structs
    + WHITESPACE
    + toCodeStruct(shaderReserved.DISPATCH_PARAMS_BUFFER_NAME, dispatchLayout)
    + WHITESPACE
    + groupBindingsCode
    + WHITESPACE
    + toCodeGroupBinding(shaderReserved.DISPATCH_GROUP_BINDING, dispatchLayout)
    + (prologue !== undefined ? WHITESPACE + prologue : '')
    + WHITESPACE
    + computePassesCode.join(WHITESPACE)
    + (epilogue !== undefined ? WHITESPACE + epilogue : '')
    + WHITESPACE
    ;
  logFuncs.lazyInfo(LOGGER, () => `Compute shader code:\n${code}`);
  return {
    code,
    entryPoints,
  };
};

export const toCodeShaderRender = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap>(
  shader: WPKRenderShader<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap, any>,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>,
): WPKShaderModuleDetail => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating render shader module detail');
  const { prologue, epilogue, groupBindings, passes } = shader;
  const structs = toCodeStructs(bufferLayouts, true);
  const groupBindingsCode = toCodeGroupBindings(groupBindings, bufferLayouts);
  const bindings = toParamsBindings<TUniform, TEntity, TBufferFormatMap, false>(bufferLayouts, false);
  const renderPassesCode = passes.map(pass => toCodeRenderPass(pass, bindings, bufferLayouts));
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
  logFuncs.lazyInfo(LOGGER, () => `Render shader code:\n${code}`);
  return {
    code,
    entryPoints,
  };
};

const toCodeStructs = (bufferLayouts: WPKBufferLayouts<any, any>, includeVaryings: boolean): string => {
  const structs = Object.entries(bufferLayouts)
    .filter(([, bufferLayout]) => includeVaryings || (bufferLayout.structType !== 'varyings'))
    .map(([structName, bufferLayout]) => shaderFuncs.isVaryingsLayout(bufferLayout)
      ? toCodeStructsVaryings(structName, bufferLayout)
      : toCodeStruct(structName, bufferLayout));
  return structs.join(WHITESPACE);
};

const toCodeStruct = (structName: string, bufferLayout: WPKBufferLayout<any, any>): string => {
  const lines = Object.entries(bufferLayout.entries).map(([entryName, entry]) => `  ${entryName} : ${toDatumType(entry)},`);
  return `struct ${capitalize(structName)} {
${lines.join('\n')}
};`;
};

const VERTEX_OUTPUT_PREFIX = 'VertexOutput';
const FRAGMENT_INPUT_PREFIX = 'FragmentInput';
const toVertexOutputStructName = (varyingsName: string): string => toDtoStructName(VERTEX_OUTPUT_PREFIX, varyingsName);
const toFragmentInputStructName = (varyingsName: string): string => toDtoStructName(FRAGMENT_INPUT_PREFIX, varyingsName);
const toDtoStructName = (prefix: string, suffix: string): string => `${prefix}_${suffix}`;
const toCodeStructsVaryings = (varyingsName: string, varyingsLayout: WPKBufferLayoutVaryings): string => {
  const vertex = toCodeDtoStruct(toVertexOutputStructName(varyingsName), { position: 'vec4<f32>' }, varyingsLayout);
  const fragment = toCodeDtoStruct(toFragmentInputStructName(varyingsName), { position: 'vec4<f32>' }, varyingsLayout);
  return [vertex, fragment].join(WHITESPACE);
};
const toCodeDtoStruct = (structName: string, builtinEntries: Record<string, WPKShaderDatumType>, varyingsLayout: WPKBufferLayoutVaryings): string => {
  const builtinLines = Object.entries(builtinEntries).map(([builtinName, builtinDatumType]) => `  @builtin(${builtinName}) builtin_${builtinName} : ${builtinDatumType},`);
  const locationLines: string[] = [];
  let location = 0;
  for (const [entryName, datumType] of Object.entries(varyingsLayout.entries)) {
    locationLines.push(`  @location(${location}) ${entryName} : ${datumType},`);
    location++;
  }
  return `struct ${structName} {
${builtinLines.join('\n')}${(locationLines.length === 0) ? '' : '\n' + locationLines.join('\n')}
};`;
};

const toDatumType = (datumTypeable: WPKShaderDatumType | WPKHasDatumType): WPKShaderDatumType => (datumTypeable as WPKHasDatumType).datumType || datumTypeable;

const toCodeGroupBindings = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeUniform extends boolean, TIncludeEntity extends boolean>(
  groupBindings: Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, TIncludeUniform, TIncludeEntity>>,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>
): string => {
  const entries = groupBindings.map((groupBinding) => {
    const { buffer } = groupBinding;
    const bufferLayout = bufferLayouts[buffer];
    if (bufferLayout === undefined) {
      throw Error(`Cannot create group binding for buffer ${buffer} due to missing buffer format. Available buffer formats: [${Object.keys(bufferLayouts).join(', ')}]`);
    }
    return toCodeGroupBinding(groupBinding, bufferLayout);
  });
  return entries.join(WHITESPACE);
};

const toCodeGroupBinding = (groupBinding: WPKGroupBinding<any, any, any, any, any>, bufferLayout: WPKBufferLayout<any, any>): string => {
  const { group, binding, buffer } = groupBinding;
  const { structType } = bufferLayout;
  const addressSpaceName = (structType === 'uniform') ? 'uniform' : 'storage';
  const accessMode = (addressSpaceName === 'uniform')
    ? ''
    : (structType === 'editable')
      ? ', read_write'
      : ', read';
  const dataType = (structType === 'uniform')
    ? capitalize(buffer)
    : `array<${capitalize(buffer)}>`;
  return `@group(${group})\n@binding(${binding})\nvar<${addressSpaceName}${accessMode}> ${buffer} : ${dataType};`;
};

const toParamsBindings = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeEntity extends boolean>(
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>,
  includeEntity: TIncludeEntity,
): WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, TIncludeEntity> => {
  return Object.entries(bufferLayouts)
    .reduce((acc, [bufferName, bufferLayout]) => {
      const { structType } = bufferLayout;
      if (!shaderFuncs.isVaryingsLayout(bufferLayout) && (structType === 'uniform' || includeEntity)) {
        const allowIndexing = (structType !== 'uniform');
        const bufferBindings = toParamsBufferBindings(bufferName, bufferLayout.entries, allowIndexing, allowIndexing);
        acc[bufferName] = bufferBindings;
      }
      return acc;
    }, {} as Record<string, Record<string, WPKDatumTypeReference<any>>>) as WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, TIncludeEntity>;
};

const toParamsBufferBindings = (
  bufferName: string,
  entries: Record<string, WPKBufferLayoutEntry<any>>,
  allowIndexing: boolean,
  allowAlternativeIndexing: boolean,
  indexingVariableOverride?: string,
): Record<string, WPKDatumTypeReference<any>> => {
  const validIndexingVariableName = indexingVariableOverride ?? BUFFER_INDEXING_VARIABLE;
  const bufferBindings = Object.entries(entries)
    .reduce((acc, [entryName, entry]) => {
      const { datumType } = entry;
      let prefix = bufferName;
      if (allowIndexing) {
        prefix += `[${validIndexingVariableName}]`;
      }
      prefix += `.${entryName}`;
      acc[entryName] = toDatumTypeReference(prefix, datumType);
      return acc;
    }, {} as Record<string, WPKDatumTypeReference<any>>);
  if (allowAlternativeIndexing) {
    (bufferBindings as any)['atIndex'] = (index: number | string | WPKDatumTypeReference<WPKShaderScalarSignedInt | WPKShaderScalarUnsignedInt>) => {
      const indexString = shaderFuncs.isDatumTypeReferenceBase(index)
        ? index.__reference
        : String(index);
      return toParamsBufferBindings(bufferName, entries, allowIndexing, false, indexString);
    };
  }
  return bufferBindings;
};

const toCodeComputePass = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  pass: WPKComputePass<TUniform, TEntity, TBufferFormatMap>,
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, true>
): string => {
  const params: WPKComputeCodeParams<TUniform, TEntity, TBufferFormatMap> = {
    instance_index: toDatumTypeReference('instance_index', 'u32'),
    bindings,
  };
  return `
@compute
@workgroup_size(${pass.workGroupSize.x}, ${pass.workGroupSize.y || 1}, ${pass.workGroupSize.z || 1})
fn ${pass.entryPoint}(
  @builtin(global_invocation_id) builtin_global_invocation_id: vec3<u32>,
  @builtin(num_workgroups) builtin_num_workgroups: vec3<u32>,
) {
  let instance_index: u32 =
  builtin_global_invocation_id.x
  + (builtin_global_invocation_id.y * builtin_num_workgroups.x)
  + (builtin_global_invocation_id.z * builtin_num_workgroups.x * builtin_num_workgroups.y);
  if (instance_index >= ${DISPATCH_PARAMS_BUFFER_NAME}.instance_count) {
    return;
  }
${pass.code(wgslTaggedTemplate, params)}
}`;
};

const toCodeRenderPass = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined>(
  pass: WPKRenderPass<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap, TVaryings>,
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>
): string => {
  const vertexPass = toCodeVertexPass(pass.vertex, bindings, bufferLayouts);
  const fragmentPass = toCodeFragmentPass(pass.fragment, bindings, bufferLayouts);
  return vertexPass
    + WHITESPACE
    + fragmentPass;
};

const toCodeVertexPass = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined>(
  pass: WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap, TVaryings>,
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>
): string => {
  const vertexBufferAttributeData = shaderFuncs.toVertexBufferAttributeData(pass.vertexBuffers, bufferLayouts);
  const locations = vertexBufferAttributeData.flatMap(attributeData =>
    attributeData.locationAttributes.map(({ attribute: { shaderLocation }, locationName, datumType }) =>
      `  @location(${shaderLocation}) ${locationName} : ${datumType},`));
  const reconstitutedMatrices = vertexBufferAttributeData.flatMap(attributeData =>
    attributeData.reconstitutedMatrices.map(({ matrixName, matrixType, vectorLocationNames }) =>
      `  let ${matrixName} = ${matrixType}(${vectorLocationNames.join(', ')});`));
  const outputType = (pass.output === undefined)
    ? '@builtin(position) vec4<f32>'
    : toVertexOutputStructName(pass.output);
  const params = toVertexCodeParams(pass, bindings, vertexBufferAttributeData);
  return `@vertex
fn ${pass.entryPoint}(
  @builtin(instance_index) builtin_instance_index: u32,
  @builtin(vertex_index) builtin_vertex_index: u32,
  @location(0) vertex_position: vec3<f32>,
${locations.join('\n')}
) -> ${outputType} {${(reconstitutedMatrices.length === 0) ? '' : '\n' + reconstitutedMatrices.join('\n')}
${pass.code(wgslTaggedTemplate, params)}
}`;
};

const toCodeFragmentPass = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined>(
  pass: WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap, TVaryings>,
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>
): string => {
  const funcParam = (pass.input === undefined)
    ? '@builtin(position) builtin_position: vec4<f32>'
    : `input: ${toFragmentInputStructName(pass.input)}`;
  const params = toFragmentCodeParams(pass, bindings, bufferLayouts);
  return `@fragment
fn ${pass.entryPoint}(${funcParam}) -> @location(0) vec4<f32> {
${pass.code(wgslTaggedTemplate, params)}
}`;
};

const toVertexCodeParams = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined>(
  pass: WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap, TVaryings>,
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>,
  vertexBufferAttributeData: Array<WPKVertexBufferAttributeData<TUniform, TEntity, TBufferFormatMap>>
): WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap, TVaryings> => {
  const vertex_buffers = Object.values(vertexBufferAttributeData)
    .reduce((vbAcc, attributeData) => {
      const { buffer, references } = attributeData;
      vbAcc[buffer] = Object.values(references)
        .reduce((fieldsAcc, { datumType, name, reference }) => {
          fieldsAcc[name] = toDatumTypeReference(reference, datumType);
          return fieldsAcc;
        }, {} as Record<string, WPKDatumTypeReference<any>>) as WPKVertexBufferFieldReferences<TUniform, TEntity, TBufferFormatMap, typeof buffer>;
      return vbAcc;
    }, {} as Record<string, any>) as WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap>;
  const paramsNoOutput: WPKRenderVertexCodeParamsNoOutput<TUniform, TEntity, TBufferFormatMap> = {
    builtin_instance_index: toDatumTypeReference('builtin_instance_index', 'u32'),
    builtin_vertex_index: toDatumTypeReference('builtin_vertex_index', 'u32'),
    vertex_position: toDatumTypeReference('vertex_position', 'vec3<f32>'),
    bindings,
    vertex_buffers,
  };
  const paramsOutput: WPKRenderVertexCodeParamsOutput | {} = (pass.output === undefined)
    ? {}
    : {
      output: {
        type: toVertexOutputStructName(pass.output),
      }
    };
  return {
    ...paramsNoOutput,
    ...paramsOutput,
  } as WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap, TVaryings>;
};

const toFragmentCodeParams = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined>(
  pass: WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap, TVaryings>,
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>,
): WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap, TVaryings> => {
  const input = toFragmentParamsInput(pass, bufferLayouts);
  return {
    bindings,
    input,
  } as WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap, TVaryings>;
};

const toFragmentParamsInput = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TVaryings extends WPKVaryingsBufferFormat<TBufferFormatMap> | undefined>(
  pass: WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap, TVaryings>,
  bufferLayouts: WPKBufferLayouts<TUniform, TEntity>,
): WPKRenderFragmentCodeParamsInput<TUniform, TEntity, TBufferFormatMap, TVaryings> => {
  if (pass.input === undefined) {
    return toDatumTypeReference('input', 'vec4<f32>') as unknown as WPKRenderFragmentCodeParamsInput<TUniform, TEntity, TBufferFormatMap, TVaryings>;
  }
  const inputBuiltin: WPKRenderFragmentCodeParamsInputBuiltin = {
    builtin_position: toDatumTypeReference('input.builtin_position', 'vec4<f32>'),
  };
  const varyingsLayout = bufferLayouts[pass.input];
  if ((varyingsLayout === undefined) || !shaderFuncs.isVaryingsLayout(varyingsLayout)) {
    throw Error(`Cannot use layout ${pass.input} ${JSON.stringify(varyingsLayout)} as a varyings layout`);
  }
  const inputVaryings: WPKRenderFragmentCodeParamsInputVaryings<any> = Object.entries(varyingsLayout.entries).reduce((acc, [entryName, datumType]) => {
    acc[entryName] = toDatumTypeReference(`input.${entryName}`, datumType);
    return acc;
  }, {} as Record<string, WPKDatumTypeReference<any>>);
  return {
    ...inputBuiltin,
    ...inputVaryings,
  } as unknown as WPKRenderFragmentCodeParamsInput<TUniform, TEntity, TBufferFormatMap, TVaryings>;
};

const toDatumTypeReference = <TDatumType extends WPKShaderDatumType>(prefix: string, datumType: TDatumType): WPKDatumTypeReference<TDatumType> => {
  const reference: Record<string, string | WPKScalarReference<any>> = toDatumTypeReferenceHidden(prefix, datumType);
  if (shaderFuncs.isVector(datumType)) {
    const componentType = shaderFuncs.toComponentType(datumType);
    const vectorLength = shaderFuncs.toDatumLength(datumType);
    const colorComponents = ['r', 'g', 'b', 'a'];
    const coordComponents = ['x', 'y', 'z', 'w'];
    const colorSwizzle = '';
    const coordSwizzle = '';
    for (let component1 = 0; component1 < vectorLength; component1++) {
      const colorSwizzle1 = colorSwizzle + colorComponents[component1];
      const coordSwizzle1 = coordSwizzle + coordComponents[component1];
      reference[colorSwizzle1] = toDatumTypeReferenceHidden(`${prefix}.${colorSwizzle1}`, componentType);
      reference[coordSwizzle1] = toDatumTypeReferenceHidden(`${prefix}.${coordSwizzle1}`, componentType);
      for (let component2 = 0; component2 < vectorLength; component2++) {
        const colorSwizzle2 = colorSwizzle1 + colorComponents[component2];
        const coordSwizzle2 = coordSwizzle1 + coordComponents[component2];
        reference[colorSwizzle2] = toDatumTypeReferenceHidden(`${prefix}.${colorSwizzle2}`, componentType);
        reference[coordSwizzle2] = toDatumTypeReferenceHidden(`${prefix}.${coordSwizzle2}`, componentType);
        if (vectorLength >= 3) {
          for (let component3 = 0; component3 < vectorLength; component3++) {
            const colorSwizzle3 = colorSwizzle2 + colorComponents[component3];
            const coordSwizzle3 = coordSwizzle2 + coordComponents[component3];
            reference[colorSwizzle3] = toDatumTypeReferenceHidden(`${prefix}.${colorSwizzle3}`, componentType);
            reference[coordSwizzle3] = toDatumTypeReferenceHidden(`${prefix}.${coordSwizzle3}`, componentType);
            if (vectorLength >= 4) {
              for (let component4 = 0; component4 < vectorLength; component4++) {
                const colorSwizzle4 = colorSwizzle3 + colorComponents[component4];
                const coordSwizzle4 = coordSwizzle3 + coordComponents[component4];
                reference[colorSwizzle4] = toDatumTypeReferenceHidden(`${prefix}.${colorSwizzle4}`, componentType);
                reference[coordSwizzle4] = toDatumTypeReferenceHidden(`${prefix}.${coordSwizzle4}`, componentType);
              }
            }
          }
        }
      }
    }
  } else if (shaderFuncs.isMatrix(datumType)) {
    const componentType = shaderFuncs.toComponentType(datumType);
    const [columns, rows] = shaderFuncs.toMatrixDimensions(datumType);
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const indices = `_${column}_${row}`;
        reference[indices] = toDatumTypeReferenceHidden(`${prefix}[${column}][${row}]`, componentType);
      }
    }
  }
  return reference as WPKDatumTypeReference<typeof datumType>;
};

const toDatumTypeReferenceHidden = (prefix: string, datumType: WPKShaderDatumType): WPKDatumTypeReferenceBase<WPKShaderDatumType> => {
  return {
    __brand: datumType,
    __reference: prefix,
  };
};

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.substring(1);

const wgslTaggedTemplate = (strings: TemplateStringsArray, ...references: (number | string | WPKDatumTypeReferenceBase<WPKShaderDatumType>)[]): string => {
  let result = '';
  for (let i = 0; i < references.length; i++) {
    result += strings[i];
    const reference = references[i];
    if (shaderFuncs.isDatumTypeReferenceBase(reference)) {
      result += reference.__reference;
    } else {
      result += reference;
    }
  }
  result += strings[strings.length - 1];
  return result;
};
