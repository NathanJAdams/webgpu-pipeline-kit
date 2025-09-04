export type WebNaga = typeof import('web-naga');
export type WPKShaderCodeStageResult = {
  source: string;
  isValid: boolean;
  error?: string;
};
export type WPKShaderCodeResult = {
  compute?: WPKShaderCodeStageResult;
  render?: WPKShaderCodeStageResult;
};
