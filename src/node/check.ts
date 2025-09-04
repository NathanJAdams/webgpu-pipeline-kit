import { logFactory } from '../logging';
import { getShaderCodeStageResult } from './diagnostics';
import { toCodeShaderCompute, toCodeShaderRender } from '../shader-code';
import { WPKPipelineDefinition, WPKShaderModuleDetail } from '../types';
import { WPKShaderCodeResult, WPKShaderCodeStageResult } from './types';

const LOGGER = logFactory.getLogger('shader');

export const checkShaderCode = async (definition: WPKPipelineDefinition<any, any, any, any>): Promise<void> => {
  const { compute, render } = await shaderCodeResult(definition);
  if (compute) {
    checkShaderCodeStage('compute', compute);
  }
  if (render) {
    checkShaderCodeStage('render', render);
  }
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
      const explanation = `${'-'.repeat(errorMarkIndex - 1)}^`;
      LOGGER.error('');
      LOGGER.error(introduction);
      LOGGER.error(context);
      LOGGER.error(explanation);
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

const shaderCodeResult = async (definition: WPKPipelineDefinition<any, any, any, any>): Promise<WPKShaderCodeResult> => {
  const { bufferFormats, shader: { compute: computeShader, render: renderShader } } = definition;
  const compute = (computeShader === undefined)
    ? undefined
    : await shaderCodeStageResult(toCodeShaderCompute(computeShader, bufferFormats));
  const render = (renderShader === undefined)
    ? undefined
    : await shaderCodeStageResult(toCodeShaderRender(renderShader, bufferFormats));
  return {
    compute,
    render,
  };
};

const shaderCodeStageResult = async (detail: WPKShaderModuleDetail): Promise<WPKShaderCodeStageResult> => {
  const { code } = detail;
  return await getShaderCodeStageResult(code);
};
