export type WebNaga = typeof import('web-naga');
export type WPKShaderCodeResult = {
  compute?: WPKShaderCodeStageResult;
  render?: WPKShaderCodeStageResult;
};
export type WPKShaderCodeStageResult = {
  source: string;
  isValid: boolean;
  error?: WPKShaderCodeError;
};
export type WPKShaderCodeError = {
  message: string;
  span: {
    start: number;
    end: number;
  };
};
