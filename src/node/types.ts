export type WPKShaderCodeDiagnosticNoLocation = {
  message: string;
};
export type WPKShaderCodeDiagnosticWithLocation = WPKShaderCodeDiagnosticNoLocation & {
  line: number;
  column: number;
};
export type WPKShaderCodeDiagnostic = WPKShaderCodeDiagnosticNoLocation | WPKShaderCodeDiagnosticWithLocation;
export type WPKShaderCodeStageResult = {
  source: string;
  isValid: boolean;
  diagnostics: WPKShaderCodeDiagnostic[];
};
export type WPKShaderCodeResult = {
  compute?: WPKShaderCodeStageResult;
  render?: WPKShaderCodeStageResult;
};
