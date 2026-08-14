export function StatusBadge({ running }: { running: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        running ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-600/20 text-slate-400"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
      {running ? "En ejecución" : "Detenido"}
    </span>
  );
}
