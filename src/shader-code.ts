import { logFactory } from './logging';
import { shaderReserved } from './shader-reserved';
import { shaderFuncs } from './shader-utils';
import { WPKBufferFormat, WPKBufferFormatMap, WPKComputeCodeParams, WPKComputePass, WPKGroupBinding, WPKMeshTemplateMap, WPKRenderFragmentCodeParams, WPKRenderPass, WPKRenderPassFragment, WPKRenderPassVertex, WPKRenderVertexCodeParams, WPKComputeShader, WPKShaderModuleDetail, WPKRenderShader, DISPATCH_PARAMS_BUFFER_NAME, WPKBufferBindingReferences, WPKVertexBufferReferences, WPKShaderDatumType, WPKDatumTypeReference, WPKScalarReference, WPKDatumTypeReferenceBase, WPKShaderScalarUnsignedInt, WPKShaderStructEntry, WPKShaderScalarSignedInt } from './types';
import { logFuncs } from './utils';

const LOGGER = logFactory.getLogger('shader');

const WHITESPACE = '\n\n';
const BUFFER_INDEXING_VARIABLE = 'instance_index';

export const toCodeShaderCompute = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  shader: WPKComputeShader<TUniform, TEntity, TBufferFormatMap>, bufferFormats: TBufferFormatMap
): WPKShaderModuleDetail => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating compute shader module detail');
  const { prologue, epilogue, groupBindings, passes } = shader;
  const entryPoints = passes.map(pass => pass.entryPoint);
  const dispatchFormat = shaderReserved.createDispatchFormat(entryPoints);
  const structs = toCodeStructs(bufferFormats, true);
  const groupBindingsCode = toCodeGroupBindings(groupBindings, bufferFormats);
  const bindings = toBindings<TUniform, TEntity, TBufferFormatMap, true>(bufferFormats, true);
  const computePassesCode = passes.map(pass => toCodeComputePass(pass, bindings));
  const code =
    structs
    + WHITESPACE
    + toCodeStruct(shaderReserved.DISPATCH_PARAMS_BUFFER_NAME, dispatchFormat)
    + WHITESPACE
    + groupBindingsCode
    + WHITESPACE
    + toCodeGroupBinding(shaderReserved.DISPATCH_GROUP_BINDING, dispatchFormat)
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
  shader: WPKRenderShader<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>, bufferFormats: TBufferFormatMap
): WPKShaderModuleDetail => {
  logFuncs.lazyDebug(LOGGER, () => 'Creating render shader module detail');
  const { prologue, epilogue, groupBindings, passes } = shader;
  const structs = toCodeStructs(bufferFormats, false);
  const groupBindingsCode = toCodeGroupBindings(groupBindings, bufferFormats);
  const bindings = toBindings<TUniform, TEntity, TBufferFormatMap, false>(bufferFormats, false);
  const renderPassesCode = passes.map(pass => toCodeRenderPass(pass, bindings, bufferFormats));
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

const toCodeStructs = (bufferMap: WPKBufferFormatMap<any, any>, includeDispatchBuffer: boolean): string => {
  return Object.entries(bufferMap)
    .filter(([name,]) => (includeDispatchBuffer || (name !== shaderReserved.DISPATCH_PARAMS_BUFFER_NAME)))
    .map(([name, bufferFormat]) => toCodeStruct(name, bufferFormat))
    .join(WHITESPACE);
};

const toCodeStruct = (structName: string, bufferFormat: WPKBufferFormat<any, any>): string => {
  const struct = (bufferFormat.bufferType === 'editable')
    ? bufferFormat.layout
    : bufferFormat.marshall;
  const lines = struct.map((entry) => `  ${entry.name} : ${entry.datumType},`);
  return `struct ${capitalize(structName)} {
${lines.join('\n')}
};`;
};

const toCodeGroupBindings = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeUniform extends boolean, TIncludeEntity extends boolean>(
  groupBindings: Array<WPKGroupBinding<TUniform, TEntity, TBufferFormatMap, TIncludeUniform, TIncludeEntity>>,
  bufferFormats: TBufferFormatMap
): string => {
  const entries = groupBindings.map((groupBinding) => {
    const { buffer } = groupBinding;
    const bufferFormat = bufferFormats[buffer];
    if (bufferFormat === undefined) {
      throw Error(`Cannot create group binding for buffer ${buffer} due to missing buffer format. Available buffer formats: [${Object.keys(bufferFormats).join(', ')}]`);
    }
    return toCodeGroupBinding(groupBinding, bufferFormat);
  });
  return entries.join(WHITESPACE);
};

const toCodeGroupBinding = (groupBinding: WPKGroupBinding<any, any, any, any, any>, bufferFormat: WPKBufferFormat<any, any>): string => {
  const { group, binding, buffer } = groupBinding;
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
};

const toBindings = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TIncludeEntity extends boolean>(
  bufferFormats: TBufferFormatMap,
  includeEntity: TIncludeEntity,
): WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, TIncludeEntity> => {
  return Object.keys(bufferFormats)
    .reduce((acc, bufferName) => {
      const bufferFormat = bufferFormats[bufferName];
      if (bufferFormat.bufferType === 'uniform' || includeEntity) {
        const structEntries = (bufferFormat.bufferType === 'editable')
          ? bufferFormat.layout
          : bufferFormat.marshall;
        const allowIndexing = (bufferFormat.bufferType !== 'uniform');
        const bufferBindings = toBufferBindings(bufferName, structEntries, allowIndexing, allowIndexing);
        acc[bufferName] = bufferBindings;
      }
      return acc;
    }, {} as Record<string, Record<string, WPKDatumTypeReference<any>>>) as WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, TIncludeEntity>;
};

const toBufferBindings = (
  bufferName: string,
  structEntries: WPKShaderStructEntry[],
  allowIndexing: boolean,
  allowAlternativeIndexing: boolean,
  indexingVariableOverride?: string,
): Record<string, WPKDatumTypeReference<any>> => {
  const validIndexingVariableName = indexingVariableOverride ?? BUFFER_INDEXING_VARIABLE;
  const bufferBindings = Object.values(structEntries)
    .reduce((acc, element) => {
      const { name, datumType } = element;
      let prefix = bufferName;
      if (allowIndexing) {
        prefix += `[${validIndexingVariableName}]`;
      }
      prefix += `.${name}`;
      acc[name] = toDatumTypeReference(prefix, datumType);
      return acc;
    }, {} as Record<string, WPKDatumTypeReference<any>>);
  if (allowAlternativeIndexing) {
    (bufferBindings as any)['atIndex'] = (index: number | string | WPKDatumTypeReference<WPKShaderScalarSignedInt | WPKShaderScalarUnsignedInt>) => {
      const indexString = shaderFuncs.isDatumTypeReferenceBase(index)
        ? index.__reference
        : String(index);
      return toBufferBindings(bufferName, structEntries, allowIndexing, false, indexString);
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
  const dispatchSize = `${DISPATCH_PARAMS_BUFFER_NAME}.${shaderReserved.dispatchSizeField(pass.entryPoint)}`;
  return `
@compute
@workgroup_size(${pass.workGroupSize.x}, ${pass.workGroupSize.y || 1}, ${pass.workGroupSize.z || 1})
fn ${pass.entryPoint}(
  @builtin(global_invocation_id) global_invocation_id: vec3<u32>,
) {
  let instance_index: u32 =
  global_invocation_id.x
  + (global_invocation_id.y * ${dispatchSize}.x)
  + (global_invocation_id.z * ${dispatchSize}.x * ${dispatchSize}.y);
  if (instance_index >= ${DISPATCH_PARAMS_BUFFER_NAME}.instance_count) {
    return;
  }
${pass.code(wgslTaggedTemplate, params)}
}`;
};

const toCodeRenderPass = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap>(
  pass: WPKRenderPass<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>,
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>,
  bufferFormats: TBufferFormatMap
): string => {
  const vertexPass = toCodeVertexPass(pass.vertex, bindings, bufferFormats);
  const fragmentPass = toCodeFragmentPass(pass.fragment, bindings);
  return vertexPass
    + WHITESPACE
    + fragmentPass;
};

const toCodeVertexPass = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  pass: WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap>,
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>,
  bufferFormats: TBufferFormatMap
): string => {
  const vertexBufferAttributeData = shaderFuncs.toVertexBufferAttributeData(pass.vertexBuffers, bufferFormats);
  const vertex_buffers = Object.values(vertexBufferAttributeData)
    .reduce((vbAcc, attributeData) => {
      const { buffer, references } = attributeData;
      vbAcc[buffer] = Object.values(references)
        .reduce((bufferAcc, { datumType, name, reference }) => {
          bufferAcc[name] = toDatumTypeReference(reference, datumType);
          return bufferAcc;
        }, {} as Record<string, WPKDatumTypeReference<any>>) as WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap>[typeof buffer];
      return vbAcc;
    }, {} as WPKVertexBufferReferences<TUniform, TEntity, TBufferFormatMap>);
  const locations = vertexBufferAttributeData.flatMap(attributeData =>
    attributeData.locationAttributes.map(({ attribute: { shaderLocation }, locationName, datumType }) =>
      `  @location(${shaderLocation}) ${locationName} : ${datumType},`));
  const reconstitutedMatrices = vertexBufferAttributeData.flatMap(attributeData =>
    attributeData.reconstitutedMatrices.map(({ matrixName, matrixType, vectorLocationNames }) =>
      `  let ${matrixName} = ${matrixType}(${vectorLocationNames.join(', ')});`));
  const params: WPKRenderVertexCodeParams<TUniform, TEntity, TBufferFormatMap> = {
    instance_index: toDatumTypeReference('instance_index', 'u32'),
    vertex_index: toDatumTypeReference('vertex_index', 'u32'),
    vertex_position: toDatumTypeReference('vertex_position', 'vec3<f32>'),
    bindings,
    vertex_buffers,
  };
  return `@vertex
fn ${pass.entryPoint}(
  @builtin(instance_index) instance_index: u32,
  @builtin(vertex_index) vertex_index: u32,
  @location(0) vertex_position: vec3<f32>,
${locations.join('\n')}
) -> @builtin(position) vec4<f32> {
${reconstitutedMatrices.join('\n')}
${pass.code(wgslTaggedTemplate, params)}
}`;
};

const toCodeFragmentPass = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
  pass: WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap>,
  bindings: WPKBufferBindingReferences<TUniform, TEntity, TBufferFormatMap, true, false>
): string => {
  const params: WPKRenderFragmentCodeParams<TUniform, TEntity, TBufferFormatMap> = {
    bindings,
    fragment_coordinate: toDatumTypeReference('fragment_coordinate', 'vec2<f32>'),
  };
  return `@fragment
fn ${pass.entryPoint}(
  @builtin(position) fragment_coordinate: vec4<f32>,
) -> @location(0) vec4<f32> {
${pass.code(wgslTaggedTemplate, params)}
}`;
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
