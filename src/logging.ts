import { Logger, LogLevelDesc } from 'loglevel';

import { LogFactory } from './utils';

type WPKLogNamespace = 'buffer' | 'cache' | 'data' | 'events' | 'mesh' | 'pipeline' | 'resources' | 'shader';

const namespaces = ['buffer', 'cache', 'data', 'events', 'mesh', 'pipeline', 'resources', 'shader'];
const prefix = 'webgpu-pipeline-kit';
const logFactory = new LogFactory(prefix, namespaces);

export const getLogger = (namespace: WPKLogNamespace): Logger => logFactory.getLogger(namespace);
export const setLogLevel = (level: LogLevelDesc, namespace?: WPKLogNamespace): void => logFactory.setLogLevel(level, namespace);
