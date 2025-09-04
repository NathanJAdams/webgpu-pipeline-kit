import { importWebNaga } from './init-web-naga';

export const getShaderCodeError = async (code: string): Promise<string | undefined> => {
  const webNaga = await importWebNaga();
  try {
    const wgsl = webNaga.WgslFrontend.new();
    const shaderModule = wgsl.parse(code);
    shaderModule.free();
  } catch (error) {
    return error as string;
  }
};
