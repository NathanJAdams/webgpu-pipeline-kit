export const stringFuncs = {
  canBePositiveInt: (str: string): boolean => '0' === str || /^[1-9]\d*$/.test(str),
  shallowStableStringify: (obj: any): string => JSON.stringify(obj, Object.keys(obj).sort()),
};
