import { getLogger } from './logging';
import { WPKBufferLayoutEntry, WPKDatumBridgeMarshalled, WPKMarshaller } from './types';
import { logFuncs } from './utils';

const LOGGER = getLogger('data');

export const marshallerFactory = {
  ofLayoutEntries: <T>(layoutEntries: Record<string, WPKBufferLayoutEntry<WPKDatumBridgeMarshalled<T>>>): WPKMarshaller<T> => {
    logFuncs.lazyDebug(LOGGER, () => 'Create marshaller');
    const datumBridges = Object.values(layoutEntries).map(entry => entry.bridge);
    const totalStride = Object.values(layoutEntries).reduce((acc, entry) => acc + entry.reserved, 0);
    logFuncs.lazyTrace(LOGGER, () => `Creating marshaller with total stride ${totalStride}`);
    return {
      encode(instances) {
        logFuncs.lazyTrace(LOGGER, () => `Encode: format ${JSON.stringify(layoutEntries)} totalStride ${totalStride}`);
        const totalSize = instances.length * totalStride;
        logFuncs.lazyTrace(LOGGER, () => `Creating data view to hold extracted instance data of size ${totalSize}`);
        const buffer = new ArrayBuffer(totalSize);
        const dataView = new DataView(buffer);
        instances.forEach((instance, index) => {
          logFuncs.lazyTrace(LOGGER, () => `Extracting data from instance ${JSON.stringify(instance)}`);
          datumBridges.forEach((datumBridge) => datumBridge.instanceToDataView(index * totalStride, instance, dataView));
        });
        return buffer;
      },
    };
  },
};
