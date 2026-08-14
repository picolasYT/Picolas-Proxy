import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { SecurityConfig } from "../lib/types";

export function Security() {
  const [security, setSecurity] = useState<SecurityConfig | null>(null);
  const [newAllow, setNewAllow] = useState("");
  const [newBlock, setNewBlock] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api.getSecurity();
    setSecurity(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(field: "allowExternal" | "allowlistMode", value: boolean) {
    setError(null);
    try {
      const { security } = await api.updateSecurity({ [field]: value });
      setSecurity(security);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error actualizando seguridad");
    }
  }

  async function addAllow() {
    if (!newAllow.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { security } = await api.addAllowlist(newAllow.trim());
      setSecurity(security);
      setNewAllow("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "IP inválida");
    } finally {
      setSaving(false);
    }
  }

  async function addBlock() {
    if (!newBlock.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { security } = await api.addBlocklist(newBlock.trim());
      setSecurity(security);
      setNewBlock("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "IP inválida");
    } finally {
      setSaving(false);
    }
  }

  async function removeAllow(ip: string) {
    const { security } = await api.removeAllowlist(ip);
    setSecurity(security);
  }

  async function removeBlock(ip: string) {
    const { security } = await api.removeBlocklist(ip);
    setSecurity(security);
  }

  if (!security) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-100">Security</h1>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Permitir acceso externo</p>
            <p className="text-xs text-slate-500">
              Si está desactivado (recomendado), el proxy sólo acepta conexiones desde localhost/LAN. Actívalo únicamente si
              entiendes el riesgo de exponer un proxy a internet.
            </p>
          </div>
          <input type="checkbox" className="w-5 h-5 accent-violet-500 shrink-0 ml-4" checked={security.allowExternal} onChange={(e) => toggle("allowExternal", e.target.checked)} />
        </div>

        <hr className="border-base-700" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Modo lista blanca (allowlist)</p>
            <p className="text-xs text-slate-500">Si se activa, sólo las IPs de la lista blanca podrán conectarse.</p>
          </div>
          <input type="checkbox" className="w-5 h-5 accent-violet-500 shrink-0 ml-4" checked={security.allowlistMode} onChange={(e) => toggle("allowlistMode", e.target.checked)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="card p-5 space-y-3">
        <p className="label">IPs permitidas (allowlist)</p>
        <div className="flex gap-2">
          <input className="input" placeholder="192.168.1.10 o 10.0.0.0/24" value={newAllow} onChange={(e) => setNewAllow(e.target.value)} />
          <button className="btn-secondary shrink-0" onClick={addAllow} disabled={saving}>Añadir</button>
        </div>
        <ul className="space-y-1">
          {security.ipAllowlist.length === 0 && <li className="text-sm text-slate-500">Ninguna IP añadida.</li>}
          {security.ipAllowlist.map((ip) => (
            <li key={ip} className="flex items-center justify-between text-sm font-mono bg-base-900 rounded-lg px-3 py-2">
              {ip}
              <button className="text-red-400 text-xs hover:underline" onClick={() => removeAllow(ip)}>Quitar</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-5 space-y-3">
        <p className="label">IPs bloqueadas (blocklist)</p>
        <div className="flex gap-2">
          <input className="input" placeholder="203.0.113.5" value={newBlock} onChange={(e) => setNewBlock(e.target.value)} />
          <button className="btn-secondary shrink-0" onClick={addBlock} disabled={saving}>Añadir</button>
        </div>
        <ul className="space-y-1">
          {security.ipBlocklist.length === 0 && <li className="text-sm text-slate-500">Ninguna IP bloqueada.</li>}
          {security.ipBlocklist.map((ip) => (
            <li key={ip} className="flex items-center justify-between text-sm font-mono bg-base-900 rounded-lg px-3 py-2">
              {ip}
              <button className="text-red-400 text-xs hover:underline" onClick={() => removeBlock(ip)}>Quitar</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
