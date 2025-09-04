import { fluentBuilder } from 'ts-fluent-builder';

import { WPKBufferFormat, WPKBufferFormatMap, WPKGroupBindingCompute, WPKGroupBindingRender, WPKMeshTemplateMap, WPKPipelineDefinition, WPKPipelineOptions, WPKRenderPassFragment, WPKRenderPassMesh, WPKRenderPassVertex, WPKShader, WPKShaderStageCompute, WPKShaderStageRender } from './types';

const bufferFormatBuilder = <TUniform, TEntity>() => fluentBuilder<WPKBufferFormat<TUniform, TEntity>>();
const computeGroupBindingsBuilder = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>() => fluentBuilder<Array<WPKGroupBindingCompute<TUniform, TEntity, TBufferFormatMap>>>();
const renderGroupBindingsBuilder = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>() => fluentBuilder<Array<WPKGroupBindingRender<TUniform, TEntity, TBufferFormatMap>>>();
const computeShaderBuilder = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>() => fluentBuilder<WPKShaderStageCompute<TUniform, TEntity, TBufferFormatMap>>();
const meshTemplateBuilder = <TMeshTemplateMap extends WPKMeshTemplateMap>() => fluentBuilder<WPKRenderPassMesh<TMeshTemplateMap>>();
const vertexShaderBuilder = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>() => fluentBuilder<WPKRenderPassVertex<TUniform, TEntity, TBufferFormatMap>>();
const fragmentShaderBuilder = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>>() => fluentBuilder<WPKRenderPassFragment<TUniform, TEntity, TBufferFormatMap>>();
const renderShaderBuilder = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap>() => fluentBuilder<WPKShaderStageRender<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>>();
const shaderBuilder = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap>() => fluentBuilder<WPKShader<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>>();
const pipelineOptionsBuilder = <TUniform, TEntity, TMutableUniform extends boolean, TMutableEntities extends boolean, TResizeableEntities extends boolean>() => fluentBuilder<WPKPipelineOptions<TUniform, TEntity, TMutableUniform, TMutableEntities, TResizeableEntities>>();
const pipelineDefinitionBuilder = <TUniform, TEntity, TBufferFormatMap extends WPKBufferFormatMap<TUniform, TEntity>, TMeshTemplateMap extends WPKMeshTemplateMap>() => fluentBuilder<WPKPipelineDefinition<TUniform, TEntity, TBufferFormatMap, TMeshTemplateMap>>();

export const builders = {
  bufferFormat: bufferFormatBuilder,
  computeGroupBindings: computeGroupBindingsBuilder,
  renderGroupBindings: renderGroupBindingsBuilder,
  computeShader: computeShaderBuilder,
  meshTemplate: meshTemplateBuilder,
  vertexShader: vertexShaderBuilder,
  fragmentShader: fragmentShaderBuilder,
  renderShader: renderShaderBuilder,
  shader: shaderBuilder,
  pipelineOptions: pipelineOptionsBuilder,
  pipelineDefinition: pipelineDefinitionBuilder,
};
