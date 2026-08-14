import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { DeviceConnection } from "../lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

export function Devices() {
  const [devices, setDevices] = useState<DeviceConnection[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const { devices } = await api.getDevices();
    setDevices(devices);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, []);

  async function disconnect(id: string) {
    await api.disconnectDevice(id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100">Devices</h1>
        <p className="text-sm text-slate-500">{devices.length} conexión(es) activa(s)</p>
      </div>

      {loading ? (
        <p className="text-slate-500">Cargando...</p>
      ) : devices.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">No hay dispositivos conectados actualmente.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-base-700">
                <th className="px-4 py-3 font-medium">IP origen</th>
                <th className="px-4 py-3 font-medium">Protocolo</th>
                <th className="px-4 py-3 font-medium">Destino</th>
                <th className="px-4 py-3 font-medium">Subida</th>
                <th className="px-4 py-3 font-medium">Bajada</th>
                <th className="px-4 py-3 font-medium">Actividad</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-base-700/60 last:border-0 hover:bg-base-800/40">
                  <td className="px-4 py-3 font-mono">{d.remoteAddress}</td>
                  <td className="px-4 py-3 uppercase text-xs text-violet-400">{d.protocol}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{d.targetHost}{d.targetPort ? `:${d.targetPort}` : ""}</td>
                  <td className="px-4 py-3">{formatBytes(d.bytesUp)}</td>
                  <td className="px-4 py-3">{formatBytes(d.bytesDown)}</td>
                  <td className="px-4 py-3 text-slate-500">{timeAgo(d.lastActivityAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs text-red-400 hover:underline" onClick={() => disconnect(d.id)}>
                      Desconectar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
