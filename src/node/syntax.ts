import { dynamicImport } from './dynamic-import';
import { WPKShaderCodeDiagnostic } from './types';

export const checkSyntax = async (code: string): Promise<WPKShaderCodeDiagnostic[]> => {
  const Parser = await dynamicImport('tree-sitter');
  const WGSL = await dynamicImport('tree-sitter-wgsl');
  const parser = new Parser();
  parser.setLanguage(WGSL);
  const tree = parser.parse(code);
  const errorNodes: any[] = [];
  gatherErrorNodes(tree.rootNode, errorNodes);
  const diagnostics: WPKShaderCodeDiagnostic[] = errorNodes.map(errorNode => ({
    type: 'syntax',
    message: 'Syntax error',
    line: errorNode.startPosition.row + 1,
    column: errorNode.startPosition.column + 1,
  }));
  return diagnostics;
};

const gatherErrorNodes = (node: any, errorNodes: any[]): void => {
  if (node.hasError) {
    errorNodes.push(node);
  }
  node.namedChildren.forEach((childNode: any) => gatherErrorNodes(childNode, errorNodes));
};
