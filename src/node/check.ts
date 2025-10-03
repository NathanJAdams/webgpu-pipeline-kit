import { getLogger } from '../logging';
import { getShaderCodeStageResult } from './diagnostics';
import { toCodeShaderCompute, toCodeShaderRender } from '../shader-code';
import { WPKBufferFormatMap, WPKComputeShader, WPKRenderShader } from '../types';
import { WPKShaderCodeStageResult } from './types';
import { bufferLayoutsFuncs } from '../buffer-layout';
import { cacheFactory } from '../cache';

const LOGGER = getLogger('shader');

export const checkComputeShaderCode = async (shader: WPKComputeShader<any, any, any>, bufferFormats: WPKBufferFormatMap<any, any>): Promise<void> => {
  const bufferLayouts = bufferLayoutsFuncs.toBufferLayouts(bufferFormats, cacheFactory.ofEntitiesResizeable(true, []), () => false, () => false);
  const computeShaderModuleDetail = toCodeShaderCompute(shader, bufferLayouts);
  const result = await getShaderCodeStageResult(computeShaderModuleDetail.code);
  checkShaderCodeStage('compute', result);
};

export const checkRenderShaderCode = async (shader: WPKRenderShader<any, any, any, any>, bufferFormats: WPKBufferFormatMap<any, any>): Promise<void> => {
  const bufferLayouts = bufferLayoutsFuncs.toBufferLayouts(bufferFormats, cacheFactory.ofEntitiesResizeable(true, []), () => false, () => false);
  const renderShaderModuleDetail = toCodeShaderRender(shader, bufferLayouts);
  const result = await getShaderCodeStageResult(renderShaderModuleDetail.code);
  checkShaderCodeStage('render', result);
};

export const checkShaderCodeStage = async (stage: string, result: WPKShaderCodeStageResult): Promise<void> => {
  const { error, isValid, source } = result;
  LOGGER.info(source);
  LOGGER.info('\n');
  if (isValid) {
    LOGGER.info(`✔ Shader stage ${stage} is valid`);
  } else {
    if (error !== undefined) {
      const startIndex = toStartIndex(source, error.span.start);
      const endIndex = toEndIndex(source, error.span.end);
      const errorMarkIndex = toErrorMarkIndex(source, error.span.start);
      const introduction = `Error: ${error.message.replace(/\\"/g, '"')}`;
      const context = source.substring(startIndex, endIndex);
      const marker = `${'-'.repeat(errorMarkIndex - 1)}^`;
      LOGGER.error('');
      LOGGER.error(introduction);
      LOGGER.error(context);
      LOGGER.error(marker);
      LOGGER.error('');
    }
    throw Error(`✘ Shader stage ${stage} is not valid`);
  }
};

const toStartIndex = (source: string, spanStart: number): number => {
  const lastWhitespaceBeforeStartIndex = source.lastIndexOf(' ', spanStart);
  if (lastWhitespaceBeforeStartIndex === -1) {
    return 0;
  }
  const lastNonWhitespaceBeforeStartMatch = source.substring(0, lastWhitespaceBeforeStartIndex).matchAll(/[\S]/g);
  if (lastNonWhitespaceBeforeStartMatch === null) {
    return 0;
  }
  const matches = [...lastNonWhitespaceBeforeStartMatch];
  const lastNonWhitespaceBeforeStartIndex = matches[matches.length - 1].index;
  if (lastNonWhitespaceBeforeStartIndex === -1) {
    return 0;
  }
  const lastNewlineIndex = source.lastIndexOf('\n', lastNonWhitespaceBeforeStartIndex);
  if (lastNewlineIndex === -1) {
    return 0;
  }
  const penultimateNewlineIndex = source.lastIndexOf('\n', lastNewlineIndex - 1);
  return (penultimateNewlineIndex === -1) ? 0 : penultimateNewlineIndex;
};

const toEndIndex = (source: string, spanEnd: number): number => {
  const lastNewline = source.indexOf('\n', spanEnd);
  const endIndex = (lastNewline === -1) ? source.length : lastNewline;
  return endIndex;
};

const toErrorMarkIndex = (source: string, spanStart: number): number => {
  const penultimateNewlineBeforeStart = source.lastIndexOf('\n', spanStart);
  return spanStart - penultimateNewlineBeforeStart;
};
