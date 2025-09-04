import { logFactory } from '../logging';
import { getShaderCodeError } from './diagnostics';
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

const checkShaderCodeStage = async (stage: string, result: WPKShaderCodeStageResult): Promise<void> => {
  const { error, isValid, source } = result;
  LOGGER.info(source);
  LOGGER.info('\n');
  if (isValid) {
    LOGGER.info(`✔ Shader stage ${stage} is valid`);
  } else {
    if (error !== undefined) {
      LOGGER.info(`${error}`);
    }
    throw Error(`✘ Shader stage ${stage} is not valid`);
  }
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
  const error = await getShaderCodeError(code);
  return {
    error,
    isValid: (error === undefined),
    source: code,
  };
};
