declare module 'tree-sitter-wgsl' {
  import { Parser } from 'tree-sitter';

  const WGSL: Parser.Language;
  export = WGSL;
}
