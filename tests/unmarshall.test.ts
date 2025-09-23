import { describe, test, expect } from 'vitest';

import { WPKBufferFormatUniform, WPKRefPath } from '../src/types';
import { unmarshallUniform } from '../src/pipeline';
import { getValueAtPath, setValueAtPath } from '../src/datum-extract-embed';

type Uniform = {
  a: [
    {
      b: {
        viewProj: [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
      }
    }
  ]
};

const bufferFormat: WPKBufferFormatUniform<Uniform> = {
  bufferType: 'uniform',
  marshall: [{
    name: 'aaa',
    datumType: 'mat4x4<f32>',
    matrix: 'a.0.b.viewProj',
  }]
};

describe('unmarshall', () => {
  test('uniforms', () => {
    const arrayBuffer = new ArrayBuffer(4 * 16);
    for (let i = 0; i < 16; i++) {
      new Float32Array(arrayBuffer)[i] = i;
    }
    const dataView = new DataView(arrayBuffer);
    const uniform = unmarshallUniform(dataView, bufferFormat);
    expect(uniform.a[0].b.viewProj).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });
  test('get value without existing path', () => {
    const instance = {};
    const refPath: WPKRefPath = ['aaa', 0, 'bbb'];
    expect(() => getValueAtPath(instance, refPath)).toThrow();
  });
  test('set value without existing path', () => {
    const instance = {};
    const refPath: WPKRefPath = ['aaa', 0, 'bbb'];
    setValueAtPath(instance, refPath, 'hi');
    const value = getValueAtPath(instance, refPath);
    expect(value).toBe('hi');
  });
});
