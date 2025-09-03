import log, { Logger, LogLevelDesc } from 'loglevel';

export class LogFactory<TNamespaces extends readonly string[]> {
  constructor(
    private readonly prefix: string,
    private readonly namespaces: TNamespaces,
  ) { }

  getLogger(namespace: TNamespaces[number]): Logger {
    return log.getLogger(`${this.prefix}:${namespace}`);
  };

  setLogLevel(level: LogLevelDesc, namespace?: TNamespaces[number]): void {
    if (namespace !== undefined) {
      this.getLogger(namespace).setLevel(level);
    } else {
      for (const namespace of this.namespaces) {
        this.getLogger(namespace).setLevel(level);
      }
    }
  };
};

export const logFuncs = {
  lazyError: (logger: Logger, errorMessageFunc: () => any): void => {
    if (logger.getLevel() >= logger.levels.ERROR) {
      logger.error(errorMessageFunc());
    }
  },
  lazyWarn: (logger: Logger, warnMessageFunc: () => any): void => {
    if (logger.getLevel() >= logger.levels.WARN) {
      logger.warn(warnMessageFunc());
    }
  },
  lazyInfo: (logger: Logger, infoMessageFunc: () => any): void => {
    if (logger.getLevel() >= logger.levels.INFO) {
      logger.info(infoMessageFunc());
    }
  },
  lazyDebug: (logger: Logger, debugMessageFunc: () => any): void => {
    if (logger.getLevel() >= logger.levels.DEBUG) {
      logger.debug(debugMessageFunc());
    }
  },
  lazyTrace: (logger: Logger, traceMessageFunc: () => any): void => {
    if (logger.getLevel() >= logger.levels.TRACE) {
      logger.log(traceMessageFunc());
    }
  },
};
