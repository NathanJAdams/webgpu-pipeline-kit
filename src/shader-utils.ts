import { WPKBufferFormatMap, WPKShaderDatumType, WPKShaderDimension, WPKShaderMatrix, WPKShaderScalar, WPKShaderStructEntry, WPKShaderVector, WPKVertexBufferLocationAttribute, WPKVertexBufferLocation, WPKVertexBufferLocationType, WPKVertexBufferLocationTypeMatrix, WPKVertexBufferAttributeData, WPKVertexBufferEntryType, WPKVertexBufferReconstitutedMatrix, WPKDatumTypeReferenceBase } from './types';

export const shaderFuncs = {
  isScalar: (datumType: WPKShaderDatumType): datumType is WPKShaderScalar => {
    return datumType.match(/^[fiu]32$/) !== null;
  },
  isVector: (datumType: WPKShaderDatumType): datumType is WPKShaderVector => {
    return datumType.match(/^vec[234]<[fiu]32>$/) !== null;
  },
  isMatrix: (datumType: WPKShaderDatumType): datumType is WPKShaderMatrix => {
    return datumType.match(/^mat[234]x[234]<[fiu]32>$/) !== null;
  },
  isLocationTypeMatrix: (locationType: WPKVertexBufferLocationType): locationType is WPKVertexBufferLocationTypeMatrix => {
    return (locationType as WPKVertexBufferLocationTypeMatrix).count !== undefined;
  },
  isDatumTypeReferenceBase: (reference: number | string | WPKDatumTypeReferenceBase<WPKShaderDatumType>): reference is WPKDatumTypeReferenceBase<WPKShaderDatumType> => {
    return (typeof reference === 'object') && (reference as WPKDatumTypeReferenceBase<WPKShaderDatumType>).__reference !== undefined;
  },
  toMatrixLocationType: (datumType: WPKShaderMatrix): WPKVertexBufferLocationTypeMatrix => {
    const componentType = shaderFuncs.toComponentType(datumType);
    const match = datumType.match(/^mat([234])x([234])<[fiu]32>$/);
    if (match === null || match.length !== 3) {
      throw Error(`Invalid matrix datum type ${datumType}`);
    }
    const [, column, row] = match;
    const count = parseInt(column, 10) as WPKShaderDimension;
    const vecDimension = parseInt(row, 10) as WPKShaderDimension;
    return {
      locationType: `vec${vecDimension}<${componentType}>`,
      count,
    };
  },
  toComponentType: (datumType: WPKShaderDatumType): WPKShaderScalar => {
    if (shaderFuncs.isScalar(datumType)) {
      return datumType;
    }
    const componentTypeMatch = datumType.match(/[^<]+<([fiu]32)>$/);
    if (componentTypeMatch) {
      return componentTypeMatch[1] as WPKShaderScalar;
    }
    throw Error(`Cannot find component type of datum type ${datumType}`);
  },
  toGPUVertexFormat: (vertexBufferEntryType: WPKVertexBufferEntryType): GPUVertexFormat => {
    const gpuScalar = shaderFuncs.toGPUScalar(vertexBufferEntryType);
    if (gpuScalar !== undefined) {
      return gpuScalar;
    }
    const vecMatch = vertexBufferEntryType.match(/^vec([2-4])<(\w+)>$/);
    if (vecMatch) {
      const size = Number(vecMatch[1]);
      const scalar = vecMatch[2];
      const gpuScalar = shaderFuncs.toGPUScalar(scalar);
      if (gpuScalar === undefined) {
        throw new Error(`Unsupported scalar type in vec${size}: ${scalar}`);
      }
      return `${gpuScalar}x${size}` as GPUVertexFormat;
    }
    throw new Error(`Unsupported type: ${vertexBufferEntryType}`);
  },
  toGPUScalar: (scalar: string): GPUVertexFormat | undefined => {
    switch (scalar) {
      case 'i32': return 'sint32';
      case 'u32': return 'uint32';
      case 'f32': return 'float32';
    }
  },
  toStrideArray: <T extends WPKShaderStructEntry>(datumTyped: T[]): number => datumTyped.reduce((acc, datumTyped) => acc + shaderFuncs.toByteLength(datumTyped.datumType), 0),
  toByteLength: (datumType: WPKShaderDatumType): number => shaderFuncs.toDatumLength(datumType) * 4,
  toDatumLength: (datumType: WPKShaderDatumType): number => DATUM_TYPE_LENGTHS[datumType],
  toMatrixDimensions: (matrixType: WPKShaderMatrix): [WPKShaderDimension, WPKShaderDimension] => {
    const match = matrixType.match(/^mat(2|3|4)x(2|3|4)<[fiu]32>$/);
    if (match !== null && match.length === 3) {
      const [, columns, rows] = match;
      return [parseInt(columns, 10) as WPKShaderDimension, parseInt(rows, 10) as WPKShaderDimension];
    }
    throw Error(`Unrecognized matrix type ${matrixType}`);
  },
  toVertexBufferLocationType: (datumType: WPKShaderDatumType): WPKVertexBufferLocationType => {
    if (shaderFuncs.isScalar(datumType)) {
      return {
        locationType: datumType,
      };
    } else if (shaderFuncs.isVector(datumType)) {
      return {
        locationType: datumType,
      };
    } else if (shaderFuncs.isMatrix(datumType)) {
      return shaderFuncs.toMatrixLocationType(datumType);
    } else {
      throw Error(`Unrecognised datum type ${datumType}`);
    }
  },
  toVertexBufferAttributeData: <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>(
    vertexBufferLocations: WPKVertexBufferLocation<TUniform, TEntity, TBufferFormatMap>[],
    bufferFormats: TBufferFormatMap,
  ): Array<WPKVertexBufferAttributeData<TUniform, TEntity, TBufferFormatMap>> => {
    const bufferFieldsTmp: Record<string, Set<string>> = {};
    for (const location of vertexBufferLocations) {
      const { buffer, field } = location;
      let fieldSet = bufferFieldsTmp[buffer];
      if (fieldSet === undefined) {
        fieldSet = new Set();
        bufferFieldsTmp[buffer] = fieldSet;
      }
      fieldSet.add(field);
    }
    const bufferFields: Array<{ buffer: string; fields: Set<string>; }> = [];
    for (const [buffer, fields] of Object.entries(bufferFieldsTmp)) {
      bufferFields.push({ buffer, fields });
    }
    bufferFields.sort((a, b) => a.buffer.localeCompare(b.buffer));
    let shaderLocation = 1; // 0 is reserved for mesh location
    const attributeDataArray: WPKVertexBufferAttributeData<TUniform, TEntity, TBufferFormatMap>[] = [];
    for (const { buffer, fields } of bufferFields) {
      const bufferFormat = bufferFormats[buffer];
      const structEntries = (bufferFormat.bufferType === 'editable')
        ? bufferFormat.layout
        : bufferFormat.marshall;
      const locationAttributes: WPKVertexBufferLocationAttribute[] = [];
      const reconstitutedMatrices: WPKVertexBufferReconstitutedMatrix[] = [];
      const stride = shaderFuncs.toStrideArray(structEntries);
      let offset = 0;
      for (const structEntry of structEntries) {
        const { name, datumType } = structEntry;
        if (fields.has(name)) {
          const locationName = `${buffer}_${name}`;
          const type = shaderFuncs.toVertexBufferLocationType(datumType);
          const format = shaderFuncs.toGPUVertexFormat(type.locationType);
          if (shaderFuncs.isMatrix(datumType)) {
            if (!shaderFuncs.isLocationTypeMatrix(type)) {
              throw Error('Mismatch between datum type and vertex buffer location type');
            }
            const vectorLocationNames: string[] = [];
            for (let i = 0; i < type.count; i++) {
              const vectorLocationName = `${locationName}_${i}`;
              vectorLocationNames.push(vectorLocationName);
              const data: WPKVertexBufferLocationAttribute = {
                fieldName: name,
                locationName: vectorLocationName,
                type,
                attribute: {
                  format,
                  offset,
                  shaderLocation,
                },
              };
              locationAttributes.push(data);
              shaderLocation++;
            }
            const reconstitutedMatrix: WPKVertexBufferReconstitutedMatrix = {
              matrixName: locationName,
              matrixType: datumType,
              vectorLocationNames,
            };
            reconstitutedMatrices.push(reconstitutedMatrix);
          } else {
            const data: WPKVertexBufferLocationAttribute = {
              fieldName: name,
              locationName,
              type,
              attribute: {
                format,
                offset,
                shaderLocation,
              },
            };
            locationAttributes.push(data);
            shaderLocation++;
          }
        }
        offset += shaderFuncs.toByteLength(datumType);
      }
      const attributeData: WPKVertexBufferAttributeData<TUniform, TEntity, TBufferFormatMap> = {
        buffer,
        locationAttributes,
        reconstitutedMatrices,
        stride,
      };
      attributeDataArray.push(attributeData);
    }
    return attributeDataArray;
  },
};

const DATUM_TYPE_LENGTHS: Record<WPKShaderDatumType, number> = {
  f32: 1,
  i32: 1,
  u32: 1,
  'vec2<i32>': 2,
  'vec2<u32>': 2,
  'vec2<f32>': 2,
  'vec3<i32>': 3,
  'vec3<u32>': 3,
  'vec3<f32>': 3,
  'vec4<i32>': 4,
  'vec4<u32>': 4,
  'vec4<f32>': 4,
  'mat2x2<f32>': 4,
  'mat2x3<f32>': 6,
  'mat2x4<f32>': 8,
  'mat3x2<f32>': 6,
  'mat3x3<f32>': 9,
  'mat3x4<f32>': 12,
  'mat4x2<f32>': 8,
  'mat4x3<f32>': 12,
  'mat4x4<f32>': 16,
};
