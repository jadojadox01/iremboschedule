const levels = {
  info: "INFO",
  warn: "WARN",
  error: "ERROR"
};

function write(level, message, meta) {
  const line = {
    level: levels[level] || "INFO",
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta } : {})
  };

  const serialized = JSON.stringify(line);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

export const logger = {
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta)
};
