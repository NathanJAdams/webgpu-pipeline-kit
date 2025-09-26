import { LogLevelDesc } from 'loglevel';

import { LogFactory } from './utils';

const namespaces = ['buffer', 'cache', 'data', 'events', 'mesh', 'pipeline', 'shader', 'resources', 'debug'];
type WPKLogNamespace = typeof namespaces[number];

const prefix = 'webgpu-pipeline-kit';

export const logFactory = new LogFactory(prefix, namespaces);

export const setLogLevel = (level: LogLevelDesc, namespace?: WPKLogNamespace): void => logFactory.setLogLevel(level, namespace);
