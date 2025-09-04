import fs from 'fs/promises';
import path from 'path';

import { WebNaga } from './types';

export const importWebNaga = (() => {
  let cached: Promise<WebNaga> | undefined;

  return async () => {
    if (cached === undefined) {
      cached = initWebNaga();
    }
    return cached;
  };
})();

const initWebNaga = async (): Promise<WebNaga> => {
  const webNaga = await import('web-naga');
  const init = webNaga.default;

  const wasmPath = path.resolve(
    path.dirname(require.resolve('web-naga')),
    'web_naga_bg.wasm'
  );
  const wasmBytes = await fs.readFile(wasmPath);
  await init(wasmBytes);

  return webNaga;
};
