import { LogFactory } from './utils';

const namespaces = ['buffer', 'cache', 'data', 'mesh', 'pipeline'];

const prefix = 'webgpu-pipeline-kit';

export const logFactory = new LogFactory(prefix, namespaces);

export const { setLogLevel } = logFactory;
