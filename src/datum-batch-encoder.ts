import { WPKFormatMarshall } from './buffer-formats';
import { WPKEntityCache } from './cache';
import { datumBridgeFactory, WPKDatumBridge } from './datum-bridge';
import { WPKInstanceFormat, WPKInstanceOf } from './instance';
import { logFactory } from './logging';
import { logFuncs } from './utils';

type WPKDatumBatchEncoder<TFormat extends WPKInstanceFormat> = {
  encode: (instances: WPKInstanceOf<TFormat>[]) => ArrayBuffer;
};

const LOGGER = logFactory.getLogger('data');

export const datumBatchEncoderFactory = {
  of: <TFormat extends WPKInstanceFormat>(marshallFormats: WPKFormatMarshall<TFormat, any>, entityCache?: WPKEntityCache<TFormat, any, any>): WPKDatumBatchEncoder<TFormat> => {
    logFuncs.lazyDebug(LOGGER, () => 'Create data extractor');
    let totalStride = 0;
    const datumBridges: WPKDatumBridge<TFormat>[] = [];
    for (const userFormat of marshallFormats) {
      logFuncs.lazyTrace(LOGGER, () => `Create ref from user format ${JSON.stringify(userFormat)}`);
      const datumOffset = totalStride;
      const datumBridge = datumBridgeFactory.of(userFormat, datumOffset, entityCache);
      datumBridges.push(datumBridge);
      totalStride += datumBridge.stride;
    }
    return {
      encode(instances) {
        logFuncs.lazyDebug(LOGGER, () => `Extract data from ${instances.length} instances`);
        const totalSize = instances.length * totalStride;
        logFuncs.lazyTrace(LOGGER, () => `Creating data view to hold extracted instance data of size ${totalSize}`);
        const buffer = new ArrayBuffer(totalSize);
        const dataView = new DataView(buffer);
        instances.forEach((instance, index) => {
          logFuncs.lazyTrace(LOGGER, () => `Extracting data from instance ${JSON.stringify(instance)}`);
          datumBridges.forEach((datumBridge) => datumBridge.bridge(index * totalStride, instance, dataView));
        });
        return buffer;
      },
    };
  },
};
