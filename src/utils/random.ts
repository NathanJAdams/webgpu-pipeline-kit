import { SFC32 } from '@thi.ng/random';

import { Range } from './range';

export type Seed = {
  a: number;
  b: number;
  c: number;
  d: number;
};

export type Random = {
  getSeed(): Seed;
  boolean(): boolean;
  false(proportion: number): boolean;
  true(proportion: number): boolean;
  int(): number;
  intRange(range: Range): number;
  intMirrorZero(minMax: number): number;
  intMinMax(min: number, max: number): number;
  float(): number;
  floatRange(range: Range): number;
  floatMirrorZero(minMax: number): number;
  floatMinMax(min: number, max: number): number;
  lowerCharCode(): number;
  upperCharCode(): number;
  word(): string;
  wordRange(range: Range): string;
  wordMinMax(min: number, max: number): string;
};

export const randomFactory = {
  ofSeed: (seed: Seed): Random => {
    const sfc32 = new SFC32([seed.a, seed.b, seed.c, seed.d]);
    return createRandomFromSfc32(sfc32);
  },
  ofString: (str: string): Random => {
    const seed = createSeedFromString(str);
    const sfc32 = new SFC32([seed.a, seed.b, seed.c, seed.d]);
    return createRandomFromSfc32(sfc32);
  },
};

const createSeedFromString = (str: string): Seed => {
  const length = str.length;
  if (length < 4) {
    throw Error(`Seed must have length >= 4 but is ${length}`);
  }
  const a = createSeedElement(str, 0, 0);
  const b = createSeedElement(str, 0, Math.round(0.25 * length));
  const c = createSeedElement(str, 0, Math.round(0.50 * length));
  const d = createSeedElement(str, 0, Math.round(0.75 * length));
  return { a, b, c, d };
};

const createSeedElement = (seed: string, hashStart: number, index: number): number => {
  const hashMiddle = hashChars(seed, hashStart, index, seed.length);
  const hashEnd = hashChars(seed, hashMiddle, 0, index);
  return hashEnd >>> 0; // Ensure it is unsigned
};

const hashChars = (seed: string, hash: number, startIndex: number, endIndex: number): number => {
  for (let i = startIndex; i < endIndex; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 0x5bd1e995);
    hash = hash ^ (hash >> 13);
  }
  return hash;
};

const createRandomFromSfc32 = (sfc32: SFC32): Random => {
  return {
    getSeed() {
      const buffer = sfc32.buffer;
      return {
        a: buffer[0],
        b: buffer[1],
        c: buffer[2],
        d: buffer[3],
      };
    },
    boolean() {
      return this.true(0.5);
    },
    false(proportion) {
      return this.true(1 - proportion);
    },
    true(proportion) {
      return sfc32.float() < proportion;
    },
    int() {
      return sfc32.int();
    },
    intRange(range: Range) {
      return this.intMinMax(range.min, range.max);
    },
    intMirrorZero(minMax: number) {
      const abs = Math.abs(minMax);
      return this.intMinMax(-abs, abs);
    },
    intMinMax(min: number, max: number) {
      return sfc32.minmaxInt(min, max + 1);
    },
    float() {
      return sfc32.float();
    },
    floatRange(range: Range) {
      return this.floatMinMax(range.min, range.max);
    },
    floatMirrorZero(minMax: number) {
      const abs = Math.abs(minMax);
      return this.floatMinMax(-abs, abs);
    },
    floatMinMax(min: number, max: number) {
      return sfc32.minmax(min, max);
    },
    lowerCharCode() {
      return this.intMinMax(97, 123);
    },
    upperCharCode() {
      return this.intMinMax(65, 91);
    },
    word() {
      const min = this.intMinMax(2, 5);
      const max = this.intMinMax(5, 8);
      return this.wordMinMax(min, max);
    },
    wordRange(range: Range) {
      return this.wordMinMax(range.min, range.max);
    },
    wordMinMax(min: number, max: number) {
      const charCodes: number[] = [];
      charCodes.push(this.upperCharCode());
      const subsequent = sfc32.minmaxUint(min, max);
      for (let i = 1; i <= subsequent; i++) {
        charCodes.push(this.lowerCharCode());
      }
      return String.fromCharCode(...charCodes);
    },
  };
};
