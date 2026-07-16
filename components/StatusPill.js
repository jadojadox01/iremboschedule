export default function StatusPill({ children, tone = "neutral" }) {
  const tones = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    neutral: "border-slate-200 bg-white text-slate-700"
  };

  return (
    <span className={`inline-flex items-center rounded border px-2 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}
