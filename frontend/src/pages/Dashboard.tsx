import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useLiveSocket } from "../lib/ws";
import { ProxyStatus } from "../lib/types";
import { StatCard } from "../components/StatCard";
import { StatusBadge } from "../components/StatusBadge";

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

function formatUptime(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

export function Dashboard() {
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { liveStats, connected } = useLiveSocket();

  async function refresh() {
    try {
      const s = await api.getStatus();
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleAction(action: "start" | "stop" | "restart") {
    setActionLoading(true);
    try {
      if (action === "start") await api.startProxy();
      if (action === "stop") await api.stopProxy();
      if (action === "restart") await api.restartProxy();
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al ejecutar la acción");
    } finally {
      setActionLoading(false);
    }
  }

  async function copyAddress() {
    if (!status) return;
    const host = status.publicIp || status.localIp;
    const port = status.mode === "socks5" ? status.socks5Port : status.httpPort;
    await navigator.clipboard.writeText(`${host}:${port}`);
  }

  if (loading || !status) {
    return <p className="text-slate-500">Cargando estado del proxy...</p>;
  }

  const running = liveStats?.running ?? status.running;
  const activeConnections = liveStats?.activeConnections ?? status.stats.activeConnections;
  const bytesUp = liveStats?.bytesUp ?? status.stats.bytesUp;
  const bytesDown = liveStats?.bytesDown ?? status.stats.bytesDown;
  const uptime = liveStats?.uptimeSeconds ?? status.uptimeSeconds;
  const cpu = liveStats?.cpuPercent ?? status.stats.cpuPercent;
  const mem = liveStats?.memPercent ?? status.stats.memPercent;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500">
            {connected ? "Conectado en vivo" : "Reconectando..."} · Picolas Proxy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge running={running} />
          {!running ? (
            <button className="btn-primary" disabled={actionLoading} onClick={() => handleAction("start")}>
              Iniciar
            </button>
          ) : (
            <>
              <button className="btn-secondary" disabled={actionLoading} onClick={() => handleAction("restart")}>
                Reiniciar
              </button>
              <button className="btn-danger" disabled={actionLoading} onClick={() => handleAction("stop")}>
                Detener
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label">Dirección del proxy</p>
          <p className="font-mono text-slate-200 truncate">
            {(status.publicIp || status.localIp)}:{status.mode === "socks5" ? status.socks5Port : status.httpPort}
            <span className="text-slate-500"> · {status.mode.toUpperCase()}</span>
          </p>
        </div>
        <button className="btn-secondary text-sm" onClick={copyAddress}>
          Copiar dirección
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tipo de proxy" value={status.mode.toUpperCase()} accent="violet" />
        <StatCard label="Dispositivos conectados" value={activeConnections} accent="magenta" />
        <StatCard label="Uptime" value={formatUptime(uptime)} accent="cyan" />
        <StatCard label="Seguridad" value={status.security.authEnabled ? "Auth activa" : "Sin auth"} sub={status.security.allowExternal ? "Acceso externo permitido" : "Sólo LAN/local"} accent="violet" />
        <StatCard label="Subida (Upload)" value={formatBytes(bytesUp)} accent="cyan" />
        <StatCard label="Bajada (Download)" value={formatBytes(bytesDown)} accent="cyan" />
        <StatCard label="Tráfico total" value={formatBytes(bytesUp + bytesDown)} accent="magenta" />
        <StatCard label="CPU / RAM" value={`${cpu}% / ${mem}%`} sub={`${status.stats.memUsedMb} MB / ${status.stats.memTotalMb} MB`} accent="violet" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="label mb-2">Red</p>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between"><dt className="text-slate-500">IP local</dt><dd className="font-mono">{status.localIp}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">IP pública</dt><dd className="font-mono">{status.publicIp || "No detectada"}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Puerto HTTP</dt><dd className="font-mono">{status.httpPort}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Puerto SOCKS5</dt><dd className="font-mono">{status.socks5Port}</dd></div>
          </dl>
        </div>
        <div className="card p-4">
          <p className="label mb-2">Entorno detectado</p>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between"><dt className="text-slate-500">Sistema</dt><dd>{status.os.platform} {status.os.release}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Arquitectura</dt><dd>{status.os.arch}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Hostname</dt><dd>{status.os.hostname}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Contenedor</dt><dd>{status.os.isContainer ? "Sí" : "No"}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
