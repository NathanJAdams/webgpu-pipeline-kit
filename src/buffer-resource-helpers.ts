import { WGBKResource, WGBKTrackedBuffer } from './buffer-resource-types';
import { Capacity, CopySlice, MathFuncs, ValueSlices } from './utils';

enum WGBKManagedBufferState {
    Initialized,
    New,
    Reused,
    Destroyed,
}

type WGBKMutatedData = {
    data: ArrayBuffer;
    index: number;
};

const VALID_BYTES_MULTIPLE = 4;
const MINIMUM_BYTES_LENGTH = 16;

const checkNotDestroyed = (state: WGBKManagedBufferState): void => {
  if (state === WGBKManagedBufferState.Destroyed) {
    throw Error('Cannot use managed buffer after being destroyed');
  }
};
const toValidSize = (label: string, bytesLength: number): number => {
  const clampedBytesLength = Math.max(MINIMUM_BYTES_LENGTH, bytesLength);
  return MathFuncs.nextMultipleOf(clampedBytesLength, VALID_BYTES_MULTIPLE);
};

export type WGBKMutable<T> = {
    mutate: (data: ArrayBuffer, target: T) => void;
};
export type WGBKResizeable = {
    resize: (bytesLength: number) => void;
};

export const WGBKBufferResourceHelpers = {
  ofData: (data: ArrayBuffer, label: string, usage: GPUBufferUsageFlags): WGBKResource<WGBKTrackedBuffer> => {
    const size = toValidSize(label, data.byteLength);
    if (size > data.byteLength) {
      const alignedBuffer = new ArrayBuffer(size);
      new Uint8Array(alignedBuffer).set(new Uint8Array(data));
      data = alignedBuffer;
    }
    usage |= GPUBufferUsage.COPY_DST;
    let state = WGBKManagedBufferState.Initialized;
    let trackedBuffer: WGBKTrackedBuffer | undefined;
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
          state = WGBKManagedBufferState.New;
          trackedBuffer = {
            isNew: true,
            buffer,
            destroy() {
              state = WGBKManagedBufferState.Destroyed;
              buffer.destroy();
            },
          };
        } else {
          if (state === WGBKManagedBufferState.New) {
            state = WGBKManagedBufferState.Reused;
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
  ofSize: (bytesLength: number, label: string, usage: GPUBufferUsageFlags): WGBKResource<WGBKTrackedBuffer> => {
    const size = toValidSize(label, bytesLength);
    let state = WGBKManagedBufferState.Initialized;
    let trackedBuffer: WGBKTrackedBuffer | undefined;
    return {
      get(device, _queue, _encoder) {
        checkNotDestroyed(state);
        if (trackedBuffer === undefined) {
          const buffer = device.createBuffer({
            label,
            size,
            usage,
          });
          state = WGBKManagedBufferState.New;
          trackedBuffer = {
            buffer,
            isNew: true,
            destroy() {
              state = WGBKManagedBufferState.Destroyed;
              buffer.destroy();
            },
          };
        } else {
          if (state === WGBKManagedBufferState.New) {
            state = WGBKManagedBufferState.Reused;
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
  ofResizeable: (copyDataOnResize: boolean, label: string, usage: GPUBufferUsageFlags): WGBKResizeable & WGBKResource<WGBKTrackedBuffer> => {
    let previousBuffer: GPUBuffer | undefined;
    let currentBuffer: GPUBuffer | undefined;
    const capacity = new Capacity(MINIMUM_BYTES_LENGTH, 1.2, 1.5);
    let previousBytesLength = capacity.capacity;
    let desiredBytesLength = 0;
    let state = WGBKManagedBufferState.Initialized;
    let trackedBuffer: WGBKTrackedBuffer | undefined;
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
          state = WGBKManagedBufferState.New;
          trackedBuffer = {
            buffer: currentBuffer,
            isNew: true,
            destroy() {
              state = WGBKManagedBufferState.Destroyed;
              newBuffer.destroy();
            },
          };
          if (copyDataOnResize && previousBuffer !== undefined) {
            const copySize = Math.min(previousBytesLength, capacity.capacity); // in case reducing capacity is supported
            if (copySize > 0) {
              encoder.copyBufferToBuffer(previousBuffer, currentBuffer, copySize);
            }
          }
        } else if (trackedBuffer !== undefined && state === WGBKManagedBufferState.New) {
          state = WGBKManagedBufferState.Reused;
          trackedBuffer = {
            ...trackedBuffer,
            isNew: false,
          };
        }
        return trackedBuffer;
      },
    };
  },
  ofMutable: (bytesLength: number, label: string, usage: GPUBufferUsageFlags): WGBKMutable<number> & WGBKResource<WGBKTrackedBuffer> => {
    const size = toValidSize(label, bytesLength);
    let state = WGBKManagedBufferState.Initialized;
    let trackedBuffer: WGBKTrackedBuffer | undefined;
    const mutatedDataArray: WGBKMutatedData[] = [];
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
          state = WGBKManagedBufferState.New;
          trackedBuffer = {
            buffer,
            isNew: true,
            destroy() {
              state = WGBKManagedBufferState.Destroyed;
              buffer.destroy();
            },
          };
        } else {
          if (state === WGBKManagedBufferState.New) {
            state = WGBKManagedBufferState.Reused;
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
  ofStaged: (label: string, usage: GPUBufferUsageFlags): WGBKMutable<CopySlice[]> & WGBKResource<WGBKTrackedBuffer> => {
    const staging = WGBKBufferResourceHelpers.ofResizeable(false, `${label}-staging`, GPUBufferUsage.COPY_SRC);
    const backing = WGBKBufferResourceHelpers.ofResizeable(true, `${label}-staging`, usage | GPUBufferUsage.COPY_DST);
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
