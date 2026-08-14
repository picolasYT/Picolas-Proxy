import { LogEntry } from "./types";

const MAX_LOGS = 500;
const logs: LogEntry[] = [];
let nextId = 1;

type Listener = (entry: LogEntry) => void;
const listeners = new Set<Listener>();

export function onLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function push(level: LogEntry["level"], scope: string, message: string) {
  const entry: LogEntry = {
    id: nextId++,
    timestamp: Date.now(),
    level,
    scope,
    message,
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();
  for (const listener of listeners) listener(entry);
  const prefix = `[${scope}]`;
  // eslint-disable-next-line no-console
  console.log(prefix, message);
  return entry;
}

export const log = {
  info: (scope: string, message: string) => push("info", scope, message),
  warn: (scope: string, message: string) => push("warn", scope, message),
  error: (scope: string, message: string) => push("error", scope, message),
  success: (scope: string, message: string) => push("success", scope, message),
};

export function getLogs(): LogEntry[] {
  return logs;
}
