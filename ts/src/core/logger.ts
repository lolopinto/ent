type logType = "query" | "warn" | "info" | "error" | "debug";
var m = {
  query: "log",
  warn: "warn",
  info: "log",
  error: "error",
  debug: "debug",
};
var logLevels = new Map<logType, boolean>();

export function setLogLevels(levels: logType | logType[]) {
  if (!Array.isArray(levels)) {
    levels = [levels];
  }
  levels.forEach((level) => logLevels.set(level, true));
}

export function clearLogLevels() {
  logLevels.clear();
}

export function log(level: logType, msg: any) {
  if (logLevels.has(level)) {
    // mostly for sqlite error but fine for any type of error
    if (level == "error" && msg instanceof Error && msg.message !== undefined) {
      console.error(msg.message);
      return;
    }
    console[m[level]](msg);
  }
}

export function logIf(level: logType, logFn: () => any) {
  if (logLevels.has(level)) {
    console[m[level]](logFn());
  }
}

export function logTrace() {
  if (logLevels.has("debug")) {
    console.trace();
  }
}

export function logEnabled(level: logType) {
  return logLevels.has(level);
}
