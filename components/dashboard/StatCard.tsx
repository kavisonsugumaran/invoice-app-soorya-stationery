type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning";
  trendPercent?: number;
};

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
};

export default function StatCard({
  label,
  value,
  hint,
  tone = "default",
  trendPercent,
}: StatCardProps) {
  const showTrend = typeof trendPercent === "number" && Number.isFinite(trendPercent);
  const isPositive = showTrend && trendPercent! >= 0;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {showTrend && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
              isPositive ? "bg-success-muted text-success" : "bg-danger-muted text-danger"
            }`}
          >
            {isPositive ? "+" : ""}
            {trendPercent}%
          </span>
        )}
      </div>
      <span className={`text-2xl font-semibold ${toneClasses[tone]}`}>{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
