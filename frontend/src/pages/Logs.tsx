import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useLiveSocket } from "../lib/ws";
import { LogEntry } from "../lib/types";

const LEVEL_STYLES: Record<LogEntry["level"], string> = {
  info: "text-slate-400",
  success: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-red-400",
};

export function Logs() {
  const [initialLogs, setInitialLogs] = useState<LogEntry[]>([]);
  const { liveLogs } = useLiveSocket();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getLogs().then((data) => setInitialLogs(data.logs));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLogs]);

  const seen = new Set(liveLogs.map((l) => l.id));
  const combined = [...initialLogs.filter((l) => !seen.has(l.id)), ...liveLogs];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">Logs</h1>
      <div className="card p-4 h-[70vh] overflow-y-auto font-mono text-xs space-y-1">
        {combined.length === 0 && <p className="text-slate-500">Sin actividad todavía.</p>}
        {combined.map((entry) => (
          <div key={entry.id} className="flex gap-2">
            <span className="text-slate-600 shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            <span className="text-violet-500 shrink-0">[{entry.scope}]</span>
            <span className={LEVEL_STYLES[entry.level]}>{entry.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
