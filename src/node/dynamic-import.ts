export const dynamicImport = async<T = any>(library: any, name?: string): Promise<T> => {
  try {
    const imported = await import(library);
    if (name && imported[name]) {
      return imported[name];
    }
    if (name && imported.default?.[name]) {
      return imported.default[name];
    }
    if (imported.default) {
      return imported.default;
    }
    return imported;
  } catch (error) {
    throw new Error(`Required dependency is missing, please install '${library}'.\n\n${error}`);
  }
};
