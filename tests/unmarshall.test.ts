import { WPKBufferFormatUniform, WPKRefPath } from '../src/types';
import { unmarshallToInstances } from '../src/pipeline';
import { getValueAtPath, setValueAtPath } from '../src/datum-extract-embed';
import { bufferLayoutsFuncs } from '../src/buffer-layout';

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
  structType: 'uniform',
  marshall: {
    aaa: {
      datumType: 'mat4x4<f32>',
      matrix: 'a.0.b.viewProj',
    }
  }
};
const bufferLayout = bufferLayoutsFuncs.toBufferLayoutUniform(bufferFormat.marshall, GPUBufferUsage.UNIFORM);

describe('unmarshall', () => {
  test('uniforms', () => {
    const arrayBuffer = new ArrayBuffer(4 * 16);
    for (let i = 0; i < 16; i++) {
      new Float32Array(arrayBuffer)[i] = i;
    }
    const dataView = new DataView(arrayBuffer);
    const uniform = unmarshallToInstances(dataView, bufferLayout, 1);
    expect(uniform[0].a[0].b.viewProj).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
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
