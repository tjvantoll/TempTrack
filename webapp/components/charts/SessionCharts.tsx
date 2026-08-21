"use client";

import { SESSION_CHART_KEYS, sessionFieldDef } from "@/lib/fields";
import type { Point } from "@/lib/series";
import type { RangeKey } from "@/lib/time-ranges";
import { TimeSeriesChart } from "./TimeSeriesChart";

export type SessionPoint = Point;

/**
 * Small multiples rather than one chart with several axes: RSSI in dBm, SINR in
 * dB, bars 0-4 and volts share no scale, and stacking them on one plot with two
 * y-axes would misrepresent every crossing.
 *
 * All four are plotted one-slot-per-session rather than on a time scale — see
 * the `xScale` note below. The trade is that equal width does not mean equal
 * elapsed time: three seconds and twelve hours look the same here, so the
 * caption says so.
 */
export function SessionCharts({
  points,
  rangeKey,
}: {
  points: SessionPoint[];
  rangeKey: RangeKey;
}) {
  const available = SESSION_CHART_KEYS.filter((key) =>
    points.some((point) => typeof point[key] === "number"),
  );

  if (!available.length) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No connectivity telemetry in this window.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {available.map((key) => {
        const def = sessionFieldDef(key);
        return (
          <div key={key}>
            <h3 className="text-sm font-semibold text-ink">{def.label}</h3>
            {def.description && <p className="mt-0.5 text-xs text-muted">{def.description}</p>}
            <div className="mt-2">
              <TimeSeriesChart
                points={points}
                series={[{ key, label: def.label, color: "var(--series-1)" }]}
                unit={def.unit ?? ""}
                rangeKey={rangeKey}
                primaryKey={key}
                precision={def.precision ?? 0}
                yDomainOverride={def.domain}
                height={170}
                /*
                 * Evenly spaced, not on a time scale. Sessions arrive in bursts
                 * seconds apart between gaps of up to half a day, so on a real
                 * time axis a burst of six reconnects collapses into a couple of
                 * pixels and reads as a vertical glitch. Time survives as the
                 * tick labels; what the axis carries is the sequence.
                 */
                xScale="ordinal"
                dots
                connectNulls
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
