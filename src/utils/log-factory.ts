import log, { Logger, LogLevelDesc } from 'loglevel';

const originalFactory = log.methodFactory;

log.methodFactory = function (methodName, level, loggerName) {
  const raw = originalFactory(methodName, level, loggerName);
  return function (...args) {
    const { stack } = new Error();
    if (stack === undefined) {
      raw(args.join(' '));
    } else {
      const stackEntry = stack.split('\n')[3] || '';
      const callerMatch = stackEntry.match(/\((.*):(\d+):(\d+)\)/) || stackEntry.match(/at (.*):(\d+):(\d+)/);
      const callerInfo = (callerMatch === null || callerMatch.length !== 4)
        ? ''
        : `${callerMatch[1]}:${callerMatch[2]}:${callerMatch[3]} `;
      raw(callerInfo + args.join(' '));
    }
  };
};

log.rebuild();

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
    if (logger.getLevel() <= logger.levels.ERROR) {
      logger.error('ERROR:', errorMessageFunc());
    }
  },
  lazyWarn: (logger: Logger, warnMessageFunc: () => any): void => {
    if (logger.getLevel() <= logger.levels.WARN) {
      logger.warn('WARN: ', warnMessageFunc());
    }
  },
  lazyInfo: (logger: Logger, infoMessageFunc: () => any): void => {
    if (logger.getLevel() <= logger.levels.INFO) {
      logger.info('INFO: ', infoMessageFunc());
    }
  },
  lazyDebug: (logger: Logger, debugMessageFunc: () => any): void => {
    if (logger.getLevel() <= logger.levels.DEBUG) {
      logger.debug('DEBUG:', debugMessageFunc());
    }
  },
  lazyTrace: (logger: Logger, traceMessageFunc: () => any): void => {
    if (logger.getLevel() <= logger.levels.TRACE) {
      logger.log('TRACE:', traceMessageFunc());
    }
  },
};
