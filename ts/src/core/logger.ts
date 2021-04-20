type logType = "query" | "warn" | "info" | "error" | "debug";
var m = {
  query: console.log,
  warn: console.warn,
  info: console.info,
  error: console.error,
  debug: console.debug,
};
var logLevels = new Map<logType, (...args: any[]) => void>();

export function setLogLevels(levels: logType | logType[]) {
  if (!Array.isArray(levels)) {
    levels = [levels];
  }
  levels.forEach((level) => logLevels.set(level, m[level]));
}

export function log(level: logType, msg: any) {
  const fn = logLevels.get(level);
  fn && fn(msg);
}

export function logTrace() {
  if (logLevels.has("debug")) {
    console.trace();
  }
}
