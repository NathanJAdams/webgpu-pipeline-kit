import { dynamicImport } from './dynamic-import';
import { WPKShaderCodeDiagnostic } from './types';

export const checkSemantics = async (code: string): Promise<WPKShaderCodeDiagnostic[]> => {
  const WgslFrontend = await dynamicImport('web-naga', 'WgslFrontend');
  try {
    const wgsl = WgslFrontend.new();
    const shaderModule = wgsl.parse(code);
    shaderModule.free();
    return [];
  } catch (error: any) {
    const errorMessage = error.message as string;
    const match = errorMessage.match(/wgsl:(\d+):(\d+): error: (.+)/);
    if (match) {
      const [, line, column, message] = match;
      return [{
        type: 'semantic',
        message,
        line: parseInt(line, 10),
        column: parseInt(column, 10),
      }];
    } else {
      return [{
        type: 'semantic',
        message: errorMessage,
      }];
    }
  }
};
