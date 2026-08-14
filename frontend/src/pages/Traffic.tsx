import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useLiveSocket } from "../lib/ws";
import { TrafficSample } from "../lib/types";
import { StatCard } from "../components/StatCard";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export function Traffic() {
  const [history, setHistory] = useState<TrafficSample[]>([]);
  const [totals, setTotals] = useState({ up: 0, down: 0 });
  const { liveStats } = useLiveSocket();

  async function load() {
    const data = await api.getTraffic();
    setHistory(data.history);
    setTotals({ up: data.totalBytesUp, down: data.totalBytesDown });
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (liveStats?.trafficSample) {
      setHistory((prev) => [...prev.slice(-59), liveStats.trafficSample]);
      setTotals({ up: liveStats.bytesUp, down: liveStats.bytesDown });
    }
  }, [liveStats]);

  const maxValue = Math.max(1, ...history.map((h) => Math.max(h.bytesUp, h.bytesDown)));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-100">Traffic</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Subida total" value={formatBytes(totals.up)} accent="violet" />
        <StatCard label="Bajada total" value={formatBytes(totals.down)} accent="cyan" />
        <StatCard label="Total" value={formatBytes(totals.up + totals.down)} accent="magenta" />
      </div>

      <div className="card p-5">
        <p className="label mb-4">Tráfico reciente (por muestra)</p>
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm">Aún no hay datos de tráfico. Inicia el proxy y genera algo de tráfico para verlo aquí.</p>
        ) : (
          <div className="flex items-end gap-1 h-40 overflow-x-auto">
            {history.map((sample, i) => (
              <div key={i} className="flex flex-col justify-end items-center gap-0.5 w-3 shrink-0" title={`↑ ${formatBytes(sample.bytesUp)} · ↓ ${formatBytes(sample.bytesDown)}`}>
                <div
                  className="w-1.5 rounded-t bg-violet-500/70"
                  style={{ height: `${Math.max(2, (sample.bytesUp / maxValue) * 100)}px` }}
                />
                <div
                  className="w-1.5 rounded-t bg-cyan-500/70"
                  style={{ height: `${Math.max(2, (sample.bytesDown / maxValue) * 100)}px` }}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-4 mt-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500" /> Subida</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-500" /> Bajada</span>
        </div>
      </div>
    </div>
  );
}
