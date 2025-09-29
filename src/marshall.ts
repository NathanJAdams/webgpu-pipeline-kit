import { datumBridgeFactory } from './datum-bridge';
import { getLogger } from './logging';
import { WPKBufferFormatMarshalled, WPKDatumBridge, WPKEntityCache, WPKMarshaller } from './types';
import { logFuncs } from './utils';

const LOGGER = getLogger('data');

export const marshallerFactory = {
  ofMarshalled: <T>(bufferFormatMarshalled: WPKBufferFormatMarshalled<T, any, any>, entityCache?: WPKEntityCache<T, any, any>): WPKMarshaller<T> => {
    logFuncs.lazyDebug(LOGGER, () => 'Create marshaller');
    let totalStride = 0;
    const datumBridges: WPKDatumBridge<T>[] = [];
    for (const formatElement of bufferFormatMarshalled.marshall) {
      logFuncs.lazyTrace(LOGGER, () => `Create ref from storage format ${JSON.stringify(formatElement)}`);
      const datumOffset = totalStride;
      const datumBridge = datumBridgeFactory.ofFormatElement(formatElement, datumOffset, entityCache);
      datumBridges.push(datumBridge);
      totalStride += datumBridge.stride;
    }
    logFuncs.lazyTrace(LOGGER, () => `Creating marshaller with total stride ${totalStride}`);
    logFuncs.lazyTrace(LOGGER, () => `Create: format ${JSON.stringify(bufferFormatMarshalled.marshall)} totalStride ${totalStride}`);
    return {
      encode(instances) {
        logFuncs.lazyTrace(LOGGER, () => `Encode: format ${JSON.stringify(bufferFormatMarshalled.marshall)} totalStride ${totalStride}`);
        logFuncs.lazyDebug(LOGGER, () => `Extract data from ${instances.length} instances ${JSON.stringify(instances)}`);
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
