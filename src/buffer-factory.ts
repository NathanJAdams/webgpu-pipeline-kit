import { WPKResource, WPKTrackedBuffer } from './buffer-types';
import { Capacity, CopySlice, mathFuncs, ValueSlices } from './utils';

enum WPKManagedBufferState {
    Initialized,
    New,
    Reused,
    Destroyed,
}

type WPKMutatedData = {
    data: ArrayBuffer;
    index: number;
};

const MINIMUM_BYTES_LENGTH = 16;
const VALID_BYTES_MULTIPLE = 4;

const checkNotDestroyed = (state: WPKManagedBufferState): void => {
  if (state === WPKManagedBufferState.Destroyed) {
    throw Error('Cannot use managed buffer after being destroyed');
  }
};
const toValidSize = (label: string, bytesLength: number): number => {
  const clampedBytesLength = Math.max(MINIMUM_BYTES_LENGTH, bytesLength);
  return mathFuncs.nextMultipleOf(clampedBytesLength, VALID_BYTES_MULTIPLE);
};

export type WPKMutable<T> = {
    mutate: (data: ArrayBuffer, target: T) => void;
};
export type WPKResizeable = {
    resize: (bytesLength: number) => void;
};

export const bufferFactory = {
  ofData: (data: ArrayBuffer, label: string, usage: GPUBufferUsageFlags): WPKResource<WPKTrackedBuffer> => {
    const size = toValidSize(label, data.byteLength);
    if (size > data.byteLength) {
      const alignedBuffer = new ArrayBuffer(size);
      new Uint8Array(alignedBuffer).set(new Uint8Array(data));
      data = alignedBuffer;
    }
    usage |= GPUBufferUsage.COPY_DST;
    let state = WPKManagedBufferState.Initialized;
    let trackedBuffer: WPKTrackedBuffer | undefined;
    return {
      get(device, queue, _encoder) {
        checkNotDestroyed(state);
        if (trackedBuffer === undefined) {
          const buffer = device.createBuffer({
            label,
            size,
            usage,
          });
          queue.writeBuffer(buffer, 0, data);
          state = WPKManagedBufferState.New;
          trackedBuffer = {
            isNew: true,
            buffer,
            destroy() {
              state = WPKManagedBufferState.Destroyed;
              buffer.destroy();
            },
          };
        } else {
          if (state === WPKManagedBufferState.New) {
            state = WPKManagedBufferState.Reused;
            trackedBuffer = {
              ...trackedBuffer,
              isNew: false,
            };
          }
        }
        return trackedBuffer;
      },
    };
  },
  ofSize: (bytesLength: number, label: string, usage: GPUBufferUsageFlags): WPKResource<WPKTrackedBuffer> => {
    const size = toValidSize(label, bytesLength);
    let state = WPKManagedBufferState.Initialized;
    let trackedBuffer: WPKTrackedBuffer | undefined;
    return {
      get(device, _queue, _encoder) {
        checkNotDestroyed(state);
        if (trackedBuffer === undefined) {
          const buffer = device.createBuffer({
            label,
            size,
            usage,
          });
          state = WPKManagedBufferState.New;
          trackedBuffer = {
            buffer,
            isNew: true,
            destroy() {
              state = WPKManagedBufferState.Destroyed;
              buffer.destroy();
            },
          };
        } else {
          if (state === WPKManagedBufferState.New) {
            state = WPKManagedBufferState.Reused;
            trackedBuffer = {
              ...trackedBuffer,
              isNew: false,
            };
          }
        }
        return trackedBuffer;
      },
    };
  },
  ofResizeable: (copyDataOnResize: boolean, label: string, usage: GPUBufferUsageFlags): WPKResizeable & WPKResource<WPKTrackedBuffer> => {
    let previousBuffer: GPUBuffer | undefined;
    let currentBuffer: GPUBuffer | undefined;
    const capacity = new Capacity(MINIMUM_BYTES_LENGTH, 1.2, 1.5);
    let previousBytesLength = capacity.capacity;
    let desiredBytesLength = 0;
    let state = WPKManagedBufferState.Initialized;
    let trackedBuffer: WPKTrackedBuffer | undefined;
    if (copyDataOnResize) {
      usage |= GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
    }
    return {
      resize(bytesLength) {
        desiredBytesLength = bytesLength;
      },
      get(device, queue, encoder) {
        checkNotDestroyed(state);
        if (previousBuffer !== undefined) {
          previousBuffer.destroy();
          previousBuffer = undefined;
        }
        if (trackedBuffer === undefined || desiredBytesLength > capacity.capacity) {
          previousBytesLength = capacity.capacity;
          capacity.ensureCapacity(desiredBytesLength);
          capacity.capacity = toValidSize(label, capacity.capacity);
          previousBuffer = currentBuffer;
          const newBuffer = currentBuffer = device.createBuffer({
            label,
            size: capacity.capacity,
            usage,
          });
          state = WPKManagedBufferState.New;
          trackedBuffer = {
            buffer: currentBuffer,
            isNew: true,
            destroy() {
              state = WPKManagedBufferState.Destroyed;
              newBuffer.destroy();
            },
          };
          if (copyDataOnResize && previousBuffer !== undefined) {
            const copySize = Math.min(previousBytesLength, capacity.capacity); // in case reducing capacity is supported
            if (copySize > 0) {
              encoder.copyBufferToBuffer(previousBuffer, currentBuffer, copySize);
            }
          }
        } else if (trackedBuffer !== undefined && state === WPKManagedBufferState.New) {
          state = WPKManagedBufferState.Reused;
          trackedBuffer = {
            ...trackedBuffer,
            isNew: false,
          };
        }
        return trackedBuffer;
      },
    };
  },
  ofMutable: (bytesLength: number, label: string, usage: GPUBufferUsageFlags): WPKMutable<number> & WPKResource<WPKTrackedBuffer> => {
    const size = toValidSize(label, bytesLength);
    let state = WPKManagedBufferState.Initialized;
    let trackedBuffer: WPKTrackedBuffer | undefined;
    const mutatedDataArray: WPKMutatedData[] = [];
    return {
      mutate(data, index) {
        mutatedDataArray.push({ data, index });
      },
      get(device, queue, _encoder) {
        checkNotDestroyed(state);
        if (trackedBuffer === undefined) {
          const buffer = device.createBuffer({
            label,
            size,
            usage,
          });
          state = WPKManagedBufferState.New;
          trackedBuffer = {
            buffer,
            isNew: true,
            destroy() {
              state = WPKManagedBufferState.Destroyed;
              buffer.destroy();
            },
          };
        } else {
          if (state === WPKManagedBufferState.New) {
            state = WPKManagedBufferState.Reused;
            trackedBuffer = {
              ...trackedBuffer,
              isNew: false,
            };
          }
        }
        const { buffer } = trackedBuffer;
        for (const { data, index } of mutatedDataArray) {
          queue.writeBuffer(buffer, index, data);
        }
        mutatedDataArray.length = 0;
        return trackedBuffer;
      },
    };
  },
  ofStaged: (label: string, usage: GPUBufferUsageFlags): WPKMutable<CopySlice[]> & WPKResource<WPKTrackedBuffer> => {
    const staging = bufferFactory.ofResizeable(false, `${label}-staging`, GPUBufferUsage.COPY_SRC);
    const backing = bufferFactory.ofResizeable(true, `${label}-staging`, usage | GPUBufferUsage.COPY_DST);
    let mutatedSlices: ValueSlices<ArrayBuffer> | undefined = undefined;
    return {
      mutate(data, target) {
        mutatedSlices = {
          values: data,
          copySlices: target,
        };
      },
      get(device, queue, encoder) {
        const backingTrackedBuffer = backing.get(device, queue, encoder);
        if (mutatedSlices !== undefined) {
          const { values, copySlices } = mutatedSlices;
          const backingSizeRequired = copySlices.reduce((max, copySlice) => Math.max(max, copySlice.toIndex + copySlice.length), 0);
          staging.resize(values.byteLength);
          backing.resize(backingSizeRequired);
          const stagingBuffer = staging.get(device, queue, encoder).buffer;
          const backingBuffer = backingTrackedBuffer.buffer;
          queue.writeBuffer(stagingBuffer, 0, values);
          for (const copySlice of copySlices) {
            const { length, min, toIndex } = copySlice;
            encoder.copyBufferToBuffer(stagingBuffer, min, backingBuffer, toIndex, length);
          }
          mutatedSlices = undefined;
        }
        return backingTrackedBuffer;
      },
    };
  },
};
