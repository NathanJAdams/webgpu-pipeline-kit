export type PositiveInteger<T extends number> =
  T extends 0
  ? never
  : `${T}` extends `${infer _}.${infer _}`
  ? never
  : `${T}` extends `-${infer _}`
  ? never
  : T
  ;

export const mathFuncs = {
  HALF_PI: 0.5 * Math.PI,
  TWO_PI: 2 * Math.PI,

  clamp: (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
  },
  gcd: (...numbers: number[]): number => {
    if (numbers.length === 0) {
      throw new Error('Array must contain at least one number.');
    }
    const gcdAB = (a: number, b: number): number => {
      while (b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
      }
      return Math.abs(a); // Ensure GCD is always positive
    };
    return numbers.reduce((acc, num) => gcdAB(acc, num));
  },
  geometricMean: (...elements: number[]): number => {
    const product = elements.reduce((total, value) => total * value, 1);
    return Math.pow(product, 1 / elements.length);
  },
  harmonicMean: (...elements: number[]): number => {
    const sumReciprocals = elements.reduce((total, value) => total + (1 / value), 0);
    return elements.length / sumReciprocals;
  },
  sumMapValues: <K, V extends number>(map: Map<K, V>): number => Array.from(map.values()).reduce((sum, value) => sum + value, 0),
  nextMultipleOf: (num: number, multiple: number): number => Math.ceil(num / multiple) * multiple,
};
