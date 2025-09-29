import { getLogger } from './logging';
import { WPKBufferMutable, WPKBufferResizeable, WPKMutatedData, WPKResource, WPKTrackedBuffer } from './types';
import { Capacity, CopySlice, logFuncs, mathFuncs, ValueSlices } from './utils';

const MINIMUM_BYTES_LENGTH = 32;
const VALID_BYTES_MULTIPLE = 16;

const LOGGER = getLogger('buffer');

const createLabeller = (label: string) => {
  let index = 0;
  let currentLabel = `${label}-${index}`;
  return {
    current: (): string => currentLabel,
    next: (): string => {
      index++;
      currentLabel = `${label}-${index}`;
      return currentLabel;
    },
  };
};

const checkNotDestroyed = (state: WPKManagedBufferState): void => {
  if (state === WPKManagedBufferState.Destroyed) {
    throw Error('Cannot use managed buffer after being destroyed');
  }
};
const toValidSize = (label: string, bytesLength: number): number => {
  const clampedBytesLength = Math.max(MINIMUM_BYTES_LENGTH, bytesLength);
  const validSize = mathFuncs.nextMultipleOf(clampedBytesLength, VALID_BYTES_MULTIPLE);
  if (validSize > bytesLength) {
    logFuncs.lazyDebug(LOGGER, () => `Increasing desired length of buffer '${label}' from ${bytesLength} to valid length ${validSize}`);
  }
  return validSize;
};

enum WPKManagedBufferState {
  Initialized,
  New,
  Reused,
  Destroyed,
}

export const bufferFactory = {
  ofData: (data: ArrayBuffer, label: string, usage: GPUBufferUsageFlags, debuggable: boolean): WPKResource<WPKTrackedBuffer> => {
    const labeller = createLabeller(label);
    logFuncs.lazyDebug(LOGGER, () => `Creating buffer '${labeller.current()}' of usage ${usageToString(usage)} from data of byte length ${data.byteLength}`);
    const size = toValidSize(labeller.current(), data.byteLength);
    if (size > data.byteLength) {
      logFuncs.lazyTrace(LOGGER, () => `Aligning buffer ${labeller.current()} to new size ${size}`);
      const alignedBuffer = new ArrayBuffer(size);
      new Uint8Array(alignedBuffer).set(new Uint8Array(data));
      data = alignedBuffer;
    }
    usage |= GPUBufferUsage.COPY_DST;
    if (debuggable) {
      usage |= GPUBufferUsage.COPY_SRC;
    }
    let state = WPKManagedBufferState.Initialized;
    let trackedBuffer: WPKTrackedBuffer | undefined;
    return {
      get(device, queue, _encoder) {
        checkNotDestroyed(state);
        if (trackedBuffer === undefined) {
          labeller.next();
          logFuncs.lazyTrace(LOGGER, () => `Creating new buffer ${labeller.current()} of size ${size} and usage ${usageToString(usage)}`);
          const buffer = device.createBuffer({
            label: labeller.current(),
            size,
            usage,
          });
          logFuncs.lazyTrace(LOGGER, () => `Writing data to new buffer ${labeller.current()} with queue`);
          queue.writeBuffer(buffer, 0, data);
          state = WPKManagedBufferState.New;
          const destroy = () => {
            state = WPKManagedBufferState.Destroyed;
            buffer.destroy();
          };
          trackedBuffer = {
            isNew: true,
            bytesLength: size,
            buffer,
            destroy,
          };
        } else {
          logFuncs.lazyTrace(LOGGER, () => `Reusing buffer ${labeller.current()}`);
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
      clean() {
      },
    };
  },
  ofSize: (bytesLength: number, label: string, usage: GPUBufferUsageFlags, debuggable: boolean): WPKResource<WPKTrackedBuffer> => {
    const labeller = createLabeller(label);
    logFuncs.lazyDebug(LOGGER, () => `Creating buffer '${labeller.current()}' of usage ${usageToString(usage)} of byte length ${bytesLength}`);
    if (debuggable) {
      usage |= GPUBufferUsage.COPY_SRC;
    }
    const size = toValidSize(labeller.current(), bytesLength);
    let state = WPKManagedBufferState.Initialized;
    let trackedBuffer: WPKTrackedBuffer | undefined;
    return {
      get(device, _queue, _encoder) {
        checkNotDestroyed(state);
        if (trackedBuffer === undefined) {
          labeller.next();
          logFuncs.lazyTrace(LOGGER, () => `Creating new buffer ${labeller.current()} of size ${size} and usage ${usageToString(usage)}`);
          const buffer = device.createBuffer({
            label: labeller.current(),
            size,
            usage,
          });
          state = WPKManagedBufferState.New;
          trackedBuffer = {
            buffer,
            bytesLength: size,
            isNew: true,
            destroy() {
              state = WPKManagedBufferState.Destroyed;
              buffer.destroy();
            },
          };
        } else {
          logFuncs.lazyTrace(LOGGER, () => `Reusing buffer ${labeller.current()}`);
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
      clean() {
      },
    };
  },
  ofResizeable: (copyDataOnResize: boolean, label: string, usage: GPUBufferUsageFlags, debuggable: boolean): WPKBufferResizeable & WPKResource<WPKTrackedBuffer> => {
    const labeller = createLabeller(label);
    logFuncs.lazyDebug(LOGGER, () => `Creating resizeable buffer '${labeller.current()}' of usage ${usageToString(usage)}`);
    const oldBuffers: GPUBuffer[] = [];
    let currentBuffer: GPUBuffer | undefined;
    const capacity = new Capacity(MINIMUM_BYTES_LENGTH, 1.2, 1.5);
    let previousBytesLength = capacity.capacity;
    let desiredBytesLength = 0;
    let state = WPKManagedBufferState.Initialized;
    let trackedBuffer: WPKTrackedBuffer | undefined;
    if (copyDataOnResize) {
      usage |= GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
    }
    if (debuggable) {
      usage |= GPUBufferUsage.COPY_SRC;
    }
    return {
      resize(bytesLength) {
        logFuncs.lazyDebug(LOGGER, () => `Resizing buffer ${labeller.current()} to desired size ${bytesLength}`);
        desiredBytesLength = bytesLength;
      },
      get(device, queue, encoder) {
        checkNotDestroyed(state);
        if (trackedBuffer === undefined || desiredBytesLength > capacity.capacity) {
          previousBytesLength = capacity.capacity;
          capacity.ensureCapacity(desiredBytesLength);
          capacity.capacity = toValidSize(labeller.current(), capacity.capacity);
          labeller.next();
          logFuncs.lazyTrace(LOGGER, () => `Creating new buffer ${labeller.current()} of size ${capacity.capacity} and usage ${usageToString(usage)}`);
          const previousBuffer = currentBuffer;
          const newBuffer = currentBuffer = device.createBuffer({
            label: labeller.current(),
            size: capacity.capacity,
            usage,
          });
          state = WPKManagedBufferState.New;
          trackedBuffer = {
            bytesLength: capacity.capacity,
            buffer: currentBuffer,
            isNew: true,
            destroy() {
              state = WPKManagedBufferState.Destroyed;
              newBuffer.destroy();
            },
          };
          if (previousBuffer !== undefined) {
            if (copyDataOnResize) {
              const copySize = Math.min(previousBytesLength, capacity.capacity); // in case reducing capacity is supported
              if (copySize > 0) {
                logFuncs.lazyTrace(LOGGER, () => `Copy ${copySize} bytes of data to buffer ${labeller.current()} from previous`);
                encoder.copyBufferToBuffer(previousBuffer, currentBuffer, copySize);
              }
            }
            oldBuffers.push(previousBuffer);
          }
        } else if (trackedBuffer !== undefined && state === WPKManagedBufferState.New) {
          logFuncs.lazyTrace(LOGGER, () => `Reusing buffer ${labeller.current()}`);
          state = WPKManagedBufferState.Reused;
          trackedBuffer = {
            ...trackedBuffer,
            isNew: false,
          };
        }
        return trackedBuffer;
      },
      clean() {
        oldBuffers.forEach((buffer) => {
          logFuncs.lazyDebug(LOGGER, () => `Destroying old buffer ${buffer.label}`);
          buffer.destroy();
        });
        oldBuffers.length = 0;
      },
    };
  },
  ofMutable: (bytesLength: number, label: string, usage: GPUBufferUsageFlags, debuggable: boolean): WPKBufferMutable<number> & WPKResource<WPKTrackedBuffer> => {
    const labeller = createLabeller(label);
    logFuncs.lazyDebug(LOGGER, () => `Creating mutable buffer '${labeller.current()}' of usage ${usageToString(usage)} from data of byte length ${bytesLength}`);
    const size = toValidSize(labeller.current(), bytesLength);
    usage |= GPUBufferUsage.COPY_DST;
    if (debuggable) {
      usage |= GPUBufferUsage.COPY_SRC;
    }
    let state = WPKManagedBufferState.Initialized;
    let trackedBuffer: WPKTrackedBuffer | undefined;
    const mutatedDataArray: WPKMutatedData[] = [];
    return {
      mutate(data, index) {
        logFuncs.lazyInfo(LOGGER, () => `Mutating data for mutable buffer ${labeller.current()}`);
        mutatedDataArray.push({ data, index });
      },
      get(device, queue, _encoder) {
        checkNotDestroyed(state);
        if (trackedBuffer === undefined) {
          labeller.next();
          logFuncs.lazyTrace(LOGGER, () => `Creating new buffer ${labeller.current()} of size ${size} and usage ${usageToString(usage)}`);
          const buffer = device.createBuffer({
            label: labeller.current(),
            size,
            usage,
          });
          state = WPKManagedBufferState.New;
          trackedBuffer = {
            bytesLength: size,
            buffer,
            isNew: true,
            destroy() {
              state = WPKManagedBufferState.Destroyed;
              buffer.destroy();
            },
          };
        } else {
          logFuncs.lazyTrace(LOGGER, () => `Reusing buffer ${labeller.current()}`);
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
          logFuncs.lazyTrace(LOGGER, () => `Writing mutated data to buffer ${labeller.current()} at index ${index} and length ${data.byteLength} using queue`);
          queue.writeBuffer(buffer, index, data);
        }
        mutatedDataArray.length = 0;
        return trackedBuffer;
      },
      clean() {
      },
    };
  },
  ofStaged: (label: string, usage: GPUBufferUsageFlags, debuggable: boolean): WPKBufferMutable<CopySlice[]> & WPKResource<WPKTrackedBuffer> => {
    logFuncs.lazyDebug(LOGGER, () => `Creating staged buffer '${label}' of usage ${usageToString(usage)}`);
    const stagingLabel = `${label}-staging`;
    const backingLabel = `${label}-backing`;
    const staging = bufferFactory.ofResizeable(false, stagingLabel, GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, debuggable);
    const backing = bufferFactory.ofResizeable(true, backingLabel, usage | GPUBufferUsage.COPY_DST, debuggable);
    let mutatedSlices: ValueSlices<ArrayBuffer> | undefined = undefined;
    return {
      mutate(data, target) {
        logFuncs.lazyDebug(LOGGER, () => `Mutating data for staged buffer ${label}, target: ${JSON.stringify(target)}`);
        mutatedSlices = {
          values: data,
          copySlices: target,
        };
      },
      get(device, queue, encoder) {
        let backingTrackedBuffer = backing.get(device, queue, encoder);
        if (mutatedSlices !== undefined) {
          logFuncs.lazyTrace(LOGGER, () => `Staging data to buffer ${stagingLabel}`);
          const { values, copySlices } = mutatedSlices;
          const backingSizeRequired = copySlices.reduce((max, copySlice) => Math.max(max, copySlice.toIndex + copySlice.length), 0);
          logFuncs.lazyTrace(LOGGER, () => `Resizing buffer ${stagingLabel} to ${values.byteLength}`);
          logFuncs.lazyTrace(LOGGER, () => `Resizing buffer ${backingLabel} to ${backingSizeRequired}`);
          staging.resize(values.byteLength);
          backing.resize(backingSizeRequired);
          backingTrackedBuffer = backing.get(device, queue, encoder);
          const stagingBuffer = staging.get(device, queue, encoder).buffer;
          const backingBuffer = backingTrackedBuffer.buffer;
          logFuncs.lazyTrace(LOGGER, () => `Writing staging data of length ${values.byteLength} to buffer ${stagingLabel} using queue`);
          queue.writeBuffer(stagingBuffer, 0, values);
          for (const copySlice of copySlices) {
            const { length, min, toIndex } = copySlice;
            logFuncs.lazyTrace(LOGGER, () => `Copy staging data from ${stagingLabel} at index ${min} to ${backingLabel} at index ${toIndex} of length ${length} using encoder`);
            encoder.copyBufferToBuffer(stagingBuffer, min, backingBuffer, toIndex, length);
          }
          mutatedSlices = undefined;
        }
        return backingTrackedBuffer;
      },
      clean() {
        staging.clean();
        backing.clean();
      },
    };
  },
};

export const usageToString = (usage: GPUBufferUsageFlags): string => {
  const flagNames: string[] = [];
  if ((usage & GPUBufferUsage.COPY_DST) === GPUBufferUsage.COPY_DST) { flagNames.push('COPY_DST'); }
  if ((usage & GPUBufferUsage.COPY_SRC) === GPUBufferUsage.COPY_SRC) { flagNames.push('COPY_SRC'); }
  if ((usage & GPUBufferUsage.INDEX) === GPUBufferUsage.INDEX) { flagNames.push('INDEX'); }
  if ((usage & GPUBufferUsage.INDIRECT) === GPUBufferUsage.INDIRECT) { flagNames.push('INDIRECT'); }
  if ((usage & GPUBufferUsage.MAP_READ) === GPUBufferUsage.MAP_READ) { flagNames.push('MAP_READ'); }
  if ((usage & GPUBufferUsage.MAP_WRITE) === GPUBufferUsage.MAP_WRITE) { flagNames.push('MAP_WRITE'); }
  if ((usage & GPUBufferUsage.QUERY_RESOLVE) === GPUBufferUsage.QUERY_RESOLVE) { flagNames.push('QUERY_RESOLVE'); }
  if ((usage & GPUBufferUsage.STORAGE) === GPUBufferUsage.STORAGE) { flagNames.push('STORAGE'); }
  if ((usage & GPUBufferUsage.UNIFORM) === GPUBufferUsage.UNIFORM) { flagNames.push('UNIFORM'); }
  if ((usage & GPUBufferUsage.VERTEX) === GPUBufferUsage.VERTEX) { flagNames.push('VERTEX'); }
  return `[${flagNames.join(', ')}]`;
};
