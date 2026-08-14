import { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "violet",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  accent?: "violet" | "magenta" | "cyan";
}) {
  const ring = {
    violet: "from-violet-500/20 to-transparent text-violet-400",
    magenta: "from-magenta-500/20 to-transparent text-magenta-400",
    cyan: "from-cyan-500/20 to-transparent text-cyan-400",
  }[accent];

  return (
    <div className="card p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="label">{label}</p>
        <p className="text-2xl font-semibold text-slate-100 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      {icon && <div className={`shrink-0 rounded-xl p-2 bg-gradient-to-br ${ring}`}>{icon}</div>}
    </div>
  );
}
