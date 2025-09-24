import { setLogLevel } from '../src/logging';
import { bufferFactory } from '../src/buffer-factory';

setLogLevel('TRACE');

const destroy = () => { };

const argReturner = () => vi.fn((...args) => ({ args }));
const mockDevice = () => ({
  createBuffer: (...args: any[]) => ({
    args,
    destroy,
  }),
}) as unknown as GPUDevice;
const mockQueue = () => ({
  writeBuffer: argReturner(),
}) as unknown as GPUQueue;
const mockEncoder = () => ({
  copyBufferToBuffer: argReturner(),
}) as unknown as GPUCommandEncoder;

describe('buffer-factory', () => {
  describe('data', () => {
    test('creates buffer of data size, writes data to it, is re-used and can be destroyed', () => {
      const device = mockDevice();
      const queue = mockQueue();
      const encoder = mockEncoder();
      const sentSize = 4;
      const expectedSize = 32;
      const sentData = new ArrayBuffer(sentSize);
      const expectedData = new ArrayBuffer(expectedSize);
      new Float32Array(sentData)[0] = 456;
      new Float32Array(expectedData)[0] = 456;
      const label = 'test-buffer';
      const usage = GPUBufferUsage.COPY_SRC | GPUBufferUsage.UNIFORM;
      const debuggable = false;
      const bufferResource = bufferFactory.ofData(sentData, label, usage, debuggable);

      const buffer1 = bufferResource.get(device, queue, encoder);
      console.log(JSON.stringify(typeof buffer1.destroy));
      expect(buffer1.bytesLength).toBe(expectedSize);
      const expectedBuffer1 = {
        ...buffer1.buffer,
        destroy,
      };
      expect(buffer1.buffer).toStrictEqual(expectedBuffer1);
      expect(buffer1.isNew).toBe(true);
      expect(queue.writeBuffer).toHaveBeenCalledWith(expectedBuffer1, 0, expectedData);

      const buffer2 = bufferResource.get(device, queue, encoder);
      console.log(JSON.stringify(typeof buffer2.destroy));
      const expectedBuffer2 = {
        ...buffer2.buffer,
        destroy,
      };
      expect(buffer2.bytesLength).toBe(expectedSize);
      expect(buffer2.buffer).toStrictEqual(expectedBuffer2);
      expect(buffer2.isNew).toBe(false);
      expect(queue.writeBuffer).toHaveBeenCalledWith(expectedBuffer2, 0, expectedData);

      buffer2.destroy();
      expect(() => bufferResource.get(device, queue, encoder)).toThrow();
    });
  });
  describe('size', () => {
    test('creates buffer of size, is re-used and can be destroyed', () => {
      const device = mockDevice();
      const queue = mockQueue();
      const encoder = mockEncoder();
      const sentSize = 4;
      const expectedSize = 32;
      const label = 'test-buffer';
      const usage = 1 | 9;
      const debuggable = false;
      const bufferResource = bufferFactory.ofSize(sentSize, label, usage, debuggable);

      const buffer1 = bufferResource.get(device, queue, encoder);
      console.log(JSON.stringify(typeof buffer1.destroy));
      expect(buffer1.bytesLength).toBe(expectedSize);
      const expectedBuffer1 = {
        ...buffer1.buffer,
        destroy,
      };
      expect(buffer1.buffer).toStrictEqual(expectedBuffer1);
      expect(buffer1.isNew).toBe(true);

      const buffer2 = bufferResource.get(device, queue, encoder);
      console.log(JSON.stringify(typeof buffer2.destroy));
      const expectedBuffer2 = {
        ...buffer2.buffer,
        destroy,
      };
      expect(buffer2.bytesLength).toBe(expectedSize);
      expect(buffer2.buffer).toStrictEqual(expectedBuffer2);
      expect(buffer2.isNew).toBe(false);

      buffer2.destroy();
      expect(() => bufferResource.get(device, queue, encoder)).toThrow();
    });
  });
  describe('resizeable', () => {
    test('creates resizeable buffer of minimum size, is re-used and can be destroyed', () => {
    });
  });
  describe('mutable', () => {
    test('', () => {
    });
  });
  describe('staged', () => {
    test('', () => {
    });
  });
});
