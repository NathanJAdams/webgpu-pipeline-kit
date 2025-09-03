import { logFactory } from '../logging';
import { checkSemantics } from './semantics';
import { toCodeShaderCompute, toCodeShaderRender } from '../shader-code';
import { checkSyntax } from './syntax';
import { WPKPipelineDefinition, WPKShaderModuleDetail } from '../types';
import { WPKShaderCodeDiagnostic, WPKShaderCodeDiagnosticWithLocation, WPKShaderCodeResult, WPKShaderCodeStageResult } from './types';

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
  const { diagnostics, isValid, source } = result;
  LOGGER.info(source);
  LOGGER.info('\n');
  if (isValid) {
    LOGGER.info(`✔ Shader stage ${stage} is valid`);
  } else {
    const errorCount = diagnostics.length;
    LOGGER.info(`✘ Shader stage ${stage} is not valid, ${errorCount} errors`);
    diagnostics.sort(diagnosticComparator);
    const lines = source.split('\n');
    let i = 0;
    for (const diagnostic of diagnostics) {
      i++;
      LOGGER.info('\n');
      if (isWithLocation(diagnostic)) {
        const { column, line } = diagnostic;
        if (line > 1) {
          LOGGER.info(`${lines[line - 1]}`);
        }
        LOGGER.info(`${lines[line]}`);
        LOGGER.info(`${' '.repeat(column)}^^^^^`);
      }
      LOGGER.info(`${i}/${errorCount} ${diagnostic.message}`);
    }
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
  const diagnostics: WPKShaderCodeDiagnostic[] = [];
  const syntaxDiagnostics = await checkSyntax(code);
  const semanticDiagnostics = await checkSemantics(code);
  diagnostics.push(...syntaxDiagnostics);
  diagnostics.push(...semanticDiagnostics);
  return {
    diagnostics,
    isValid: (diagnostics.length === 0),
    source: code,
  };
};

const isWithLocation = (diagnostic: WPKShaderCodeDiagnostic): diagnostic is WPKShaderCodeDiagnosticWithLocation => {
  return (diagnostic as WPKShaderCodeDiagnosticWithLocation).column !== undefined;
};
const diagnosticComparator = (a: WPKShaderCodeDiagnostic, b: WPKShaderCodeDiagnostic): number => {
  const isLocatedA = isWithLocation(a);
  const isLocatedB = isWithLocation(b);
  if (isLocatedA && isLocatedB) {
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return a.column - b.column;
  } else if (isLocatedA) {
    return 1;
  } else if (isLocatedB) {
    return -1;
  } else {
    if (a.type !== b.type) {
      return (a.type === 'syntax')
        ? -1
        : 1;
    } else {
      return (a.message.localeCompare(b.message));
    }
  }
};
