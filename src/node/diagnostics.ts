import { importWebNaga } from './init-web-naga';
import { WPKShaderCodeError, WPKShaderCodeStageResult } from './types';

export const getShaderCodeStageResult = async (code: string): Promise<WPKShaderCodeStageResult> => {
  const webNaga = await importWebNaga();
  try {
    const wgsl = webNaga.WgslFrontend.new();
    const shaderModule = wgsl.parse(code);
    shaderModule.free();
    return {
      isValid: true,
      source: code,
    };
  } catch (errorString) {
    const error = toShaderCodeError(errorString as string);
    return {
      isValid: false,
      source: code,
      error,
    };
  }
};

export const toShaderCodeError = (error: string): WPKShaderCodeError | undefined => {
  const match = error.match(/message: "(.*)".*start: (\d+).*end: (\d+)/);
  if (match !== null && match.length === 4) {
    const [, message, start, end] = match;
    return {
      message,
      span: {
        start: parseInt(start, 10),
        end: parseInt(end, 10),
      }
    };
  }
};
