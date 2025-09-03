export type WPKDynamicallyImportedLibrary = 'tree-sitter' | 'tree-sitter-wgsl' | 'web-naga';

export const dynamicImport = async<T = any>(library: WPKDynamicallyImportedLibrary, name?: string): Promise<T> => {
  try {
    const imported = await importLibrary(library);
    if (name) {
      if (imported[name]) {
        return imported[name];
      }
      if (imported.default?.[name]) {
        return imported.default[name];
      }
      throw new Error(`Export '${name}' not found in '${library}'`);
    }
    return imported.default ?? imported;
  } catch (error) {
    throw new Error(`Required dependency is missing, please install '${library}'.\n\n${error}`);
  }
};

const importLibrary = async (library: WPKDynamicallyImportedLibrary): Promise<any> => {
  switch (library) {
    case 'tree-sitter': return await import('tree-sitter');
    case 'tree-sitter-wgsl': return await import('tree-sitter-wgsl');
    case 'web-naga': return await import('web-naga');
  }
};
