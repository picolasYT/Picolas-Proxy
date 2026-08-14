import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { ProxyConfigSafe, ProxyMode } from "../lib/types";
import { StatusBadge } from "../components/StatusBadge";
import { useLiveSocket } from "../lib/ws";

export function ProxyPage() {
  const [config, setConfig] = useState<ProxyConfigSafe | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { liveStats } = useLiveSocket();

  async function load() {
    const { proxy } = await api.getProxyConfig();
    setConfig(proxy);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { proxy } = await api.updateProxyConfig(config);
      setConfig(proxy);
      setMessage("Configuración guardada. Reinicia el proxy para aplicar cambios de puerto o modo.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error guardando la configuración");
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(action: "start" | "stop" | "restart") {
    setError(null);
    try {
      if (action === "start") await api.startProxy();
      if (action === "stop") await api.stopProxy();
      if (action === "restart") await api.restartProxy();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al ejecutar la acción");
    }
  }

  if (loading || !config) return <p className="text-slate-500">Cargando...</p>;

  const running = liveStats?.running ?? false;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-100">Proxy</h1>
        <StatusBadge running={running} />
      </div>

      <div className="card p-4 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => handleAction("start")} disabled={running}>Iniciar</button>
        <button className="btn-secondary" onClick={() => handleAction("restart")}>Reiniciar</button>
        <button className="btn-danger" onClick={() => handleAction("stop")} disabled={!running}>Detener</button>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Tipo de proxy</label>
          <div className="grid grid-cols-3 gap-2">
            {(["http", "socks5", "both"] as ProxyMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setConfig({ ...config, mode })}
                className={`rounded-lg py-2 text-sm font-medium border ${
                  config.mode === mode ? "border-violet-500 bg-violet-500/10 text-violet-300" : "border-base-700 text-slate-400 hover:bg-base-800"
                }`}
              >
                {mode === "http" ? "HTTP / CONNECT" : mode === "socks5" ? "SOCKS5" : "Ambos"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Puerto HTTP</label>
            <input
              className="input"
              type="number"
              value={config.httpPort}
              onChange={(e) => setConfig({ ...config, httpPort: Number(e.target.value) })}
              disabled={config.mode === "socks5"}
            />
          </div>
          <div>
            <label className="label">Puerto SOCKS5</label>
            <input
              className="input"
              type="number"
              value={config.socks5Port}
              onChange={(e) => setConfig({ ...config, socks5Port: Number(e.target.value) })}
              disabled={config.mode === "http"}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Iniciar automáticamente</p>
            <p className="text-xs text-slate-500">Arranca el proxy al iniciar el servidor</p>
          </div>
          <input
            type="checkbox"
            className="w-5 h-5 accent-violet-500"
            checked={config.autoStart}
            onChange={(e) => setConfig({ ...config, autoStart: e.target.checked })}
          />
        </div>

        <hr className="border-base-700" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Autenticación (usuario/contraseña)</p>
            <p className="text-xs text-slate-500">Recomendado mantener activa</p>
          </div>
          <input
            type="checkbox"
            className="w-5 h-5 accent-violet-500"
            checked={config.authEnabled}
            onChange={(e) => setConfig({ ...config, authEnabled: e.target.checked })}
          />
        </div>

        <div>
          <label className="label">Usuario del proxy</label>
          <input className="input" value={config.username} onChange={(e) => setConfig({ ...config, username: e.target.value })} />
        </div>

        <div>
          <label className="label">Nueva contraseña (opcional)</label>
          <input
            className="input"
            type="password"
            placeholder="Dejar en blanco para no cambiarla"
            onChange={(e) => setConfig({ ...config, newPassword: e.target.value } as any)}
          />
        </div>

        {message && <p className="text-sm text-emerald-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        <button className="btn-primary w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}
