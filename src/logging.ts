import { LogLevelDesc } from 'loglevel';

import { LogFactory } from './utils';

const namespaces = ['buffer', 'cache', 'data', 'mesh', 'pipeline', 'shader', 'resources', 'debug'];

const prefix = 'webgpu-pipeline-kit';

export const logFactory = new LogFactory(prefix, namespaces);

export const setLogLevel = (level: LogLevelDesc, namespace?: typeof namespaces[number]): void => logFactory.setLogLevel(level, namespace);
