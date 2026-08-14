import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export function Settings() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await api.logout();
    navigate("/login");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>

      <div className="card p-5 space-y-2">
        <p className="label">Acerca de</p>
        <p className="text-sm text-slate-300">
          <span className="font-semibold gradient-text">Picolas Proxy</span> — Your network. Your proxy.
        </p>
        <p className="text-sm text-slate-500">
          Herramienta open-source para convertir una PC, VPS o sandbox en un proxy HTTP/SOCKS5 administrable desde un panel
          web. Sin base de datos: la configuración se guarda en <code className="text-slate-400">data/config.json</code> y las
          estadísticas se mantienen en memoria mientras el proceso está activo.
        </p>
      </div>

      <div className="card p-5 space-y-2">
        <p className="label">Consejos de seguridad</p>
        <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
          <li>Cambia la contraseña por defecto desde la sección Proxy antes de usarlo en producción.</li>
          <li>Mantén "Permitir acceso externo" desactivado salvo que sepas exactamente qué implica.</li>
          <li>Usa la lista blanca de IPs si sólo un grupo reducido de dispositivos debe conectarse.</li>
          <li>Revisa la sección Logs regularmente para detectar accesos inesperados.</li>
        </ul>
      </div>

      <div className="card p-5">
        <button className="btn-danger" onClick={handleLogout} disabled={loggingOut}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
