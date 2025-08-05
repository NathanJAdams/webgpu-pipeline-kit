import log, { Logger, LogLevelDesc } from 'loglevel';

export type WPKLogNamespace =
  | 'buffer'
  | 'cache'
  | 'data'
  | 'mesh'
  | 'pipeline'
  ;

const prefix = 'webgpu-pipeline-kit';

export const getLogger = (namespace: WPKLogNamespace): Logger => log.getLogger(`${prefix}:${namespace}`);

export const lazyError = (logger: Logger, errorMessageFunc: () => any): void => {
  if (logger.getLevel() <= logger.levels.ERROR) {
    logger.error(errorMessageFunc());
  }
};
export const lazyWarn = (logger: Logger, warnMessageFunc: () => any): void => {
  if (logger.getLevel() <= logger.levels.WARN) {
    logger.warn(warnMessageFunc());
  }
};
export const lazyInfo = (logger: Logger, infoMessageFunc: () => any): void => {
  if (logger.getLevel() <= logger.levels.INFO) {
    logger.info(infoMessageFunc());
  }
};
export const lazyDebug = (logger: Logger, debugMessageFunc: () => any): void => {
  if (logger.getLevel() <= logger.levels.DEBUG) {
    logger.debug(debugMessageFunc());
  }
};
export const lazyTrace = (logger: Logger, traceMessageFunc: () => any): void => {
  if (logger.getLevel() <= logger.levels.TRACE) {
    logger.trace(traceMessageFunc());
  }
};


export const setLogLevel = (level: LogLevelDesc, namespace?: WPKLogNamespace): void => {
  if (namespace !== undefined) {
    getLogger(namespace).setLevel(level);
  } else {
    const allLoggers = log.getLoggers();
    for (const [name, logger] of Object.entries(allLoggers)) {
      if (name.startsWith(prefix)) {
        logger.setLevel(level);
      }
    }
  }
};
