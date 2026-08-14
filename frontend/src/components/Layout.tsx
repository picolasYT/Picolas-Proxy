import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useLiveSocket } from "../lib/ws";
import { StatusBadge } from "./StatusBadge";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/proxy", label: "Proxy", icon: "🔀" },
  { to: "/devices", label: "Devices", icon: "💻" },
  { to: "/traffic", label: "Traffic", icon: "📈" },
  { to: "/security", label: "Security", icon: "🛡️" },
  { to: "/logs", label: "Logs", icon: "🧾" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export function Layout() {
  const navigate = useNavigate();
  const { liveStats } = useLiveSocket();

  async function handleLogout() {
    await api.logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-base-700 bg-base-900/60 backdrop-blur-sm p-4 flex md:flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <div className="w-8 h-8 rounded-lg bg-picolas-gradient shadow-glow" />
          <div>
            <p className="font-semibold text-slate-100 leading-none">Picolas Proxy</p>
            <p className="text-[10px] text-slate-500 tracking-wide">Your network. Your proxy.</p>
          </div>
        </div>

        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  isActive ? "bg-base-700 text-slate-100" : "text-slate-400 hover:bg-base-800 hover:text-slate-200"
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto hidden md:flex flex-col gap-3 pt-4 border-t border-base-700">
          <StatusBadge running={liveStats?.running ?? false} />
          <button onClick={handleLogout} className="btn-secondary text-sm">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8 space-y-6">
        <Outlet />
      </main>
    </div>
  );
}
