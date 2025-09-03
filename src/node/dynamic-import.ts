export const dynamicImport = async<T = any>(library: string, name?: string): Promise<T> => {
  try {
    const imported = await import(library);
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
