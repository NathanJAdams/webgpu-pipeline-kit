import { getLogger } from './logging';
import { WPKBufferLayoutEntry, WPKDatumBridgeMarshalled, WPKMarshaller } from './types';
import { logFuncs } from './utils';

const LOGGER = getLogger('data');

export const marshallerFactory = {
  ofLayoutEntries: <T>(
    layoutEntries: Record<string, WPKBufferLayoutEntry<WPKDatumBridgeMarshalled<T>>>,
    totalStride: number,
  ): WPKMarshaller<T> => {
    logFuncs.lazyDebug(LOGGER, () => 'Create marshaller');
    const datumBridges = Object.values(layoutEntries).map(entry => entry.bridge);
    logFuncs.lazyTrace(LOGGER, () => `Creating marshaller with total stride ${totalStride}`);
    return {
      encode(instances) {
        logFuncs.lazyTrace(LOGGER, () => `Encoding ${instances.length} instances of total stride ${totalStride} with format ${JSON.stringify(layoutEntries)}`);
        const totalSize = instances.length * totalStride;
        logFuncs.lazyTrace(LOGGER, () => `Creating data view to hold extracted instance data of size ${totalSize}`);
        const buffer = new ArrayBuffer(totalSize);
        const dataView = new DataView(buffer);
        instances.forEach((instance, index) => {
          logFuncs.lazyTrace(LOGGER, () => `Extracting data from instance ${index + 1}/${instances.length} ${JSON.stringify(instance)}`);
          datumBridges.forEach((datumBridge) => datumBridge.instanceToDataView(index * totalStride, instance, dataView));
        });
        return buffer;
      },
    };
  },
};
