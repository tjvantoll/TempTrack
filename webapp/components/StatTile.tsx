import { formatNumber } from "@/lib/fields";
import type { SeriesSummary } from "@/lib/series";

export function StatTile({
  label,
  value,
  unit,
  precision = 0,
  summary,
  note,
  text,
}: {
  label: string;
  value: number | null;
  unit: string;
  precision?: number;
  summary?: SeriesSummary | null;
  note?: string;
  /**
   * Rendered in place of `value` for a tile whose reading is not a number —
   * a configured range, say. Set at a readable size rather than the numeric
   * display size, which a short phrase overflows.
   */
  text?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      {text === undefined ? (
        <p className="mt-1.5 flex items-baseline gap-1">
          <span className="tnum text-2xl font-semibold text-ink">
            {value === null ? "—" : formatNumber(value, precision)}
          </span>
          {unit && <span className="text-sm text-muted">{unit}</span>}
        </p>
      ) : (
        <p className="tnum mt-1.5 text-lg font-semibold text-ink">{text}</p>
      )}
      {summary ? (
        <p className="tnum mt-1 text-xs text-muted">
          min {formatNumber(summary.min, precision)} · avg{" "}
          {formatNumber(summary.avg, precision)} · max {formatNumber(summary.max, precision)}
        </p>
      ) : (
        note && <p className="mt-1 text-xs text-muted">{note}</p>
      )}
    </div>
  );
}
