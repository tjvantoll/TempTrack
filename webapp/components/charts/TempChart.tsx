"use client";

import { useMemo } from "react";
import { TimeSeriesChart, type Band, type Rule } from "@/components/charts/TimeSeriesChart";
import { fromCelsius, unitLabel, type Unit } from "@/lib/temperature";
import type { Point } from "@/lib/series";
import type { RangeKey } from "@/lib/time-ranges";

/**
 * Temperature over time, with the configured alert band drawn behind it.
 *
 * One thing about the band is worth being explicit about in the copy around
 * this chart: it is the band as configured *now*, not as configured at each
 * fix. Alerts carry the thresholds that were in force when they fired, so this
 * is a reference line, not a replay — a threshold changed yesterday will look
 * as though it applied to last week.
 *
 * The trace can also sit outside the band without a matching alert, because the
 * device only evaluates thresholds while it considers itself moving.
 */
export function TempChart({
  points,
  rangeKey,
  unit,
  minC,
  maxC,
}: {
  points: Point[];
  rangeKey: RangeKey;
  unit: Unit;
  /** Active thresholds in °C, or null where alerting is off in that direction. */
  minC: number | null;
  maxC: number | null;
}) {
  // Everything upstream is Celsius; convert once, here, so the axis, the
  // tooltip and the threshold geometry all agree.
  const converted = useMemo<Point[]>(
    () =>
      points.map((point) => ({
        ...point,
        temperature:
          typeof point.temperature === "number" ? fromCelsius(point.temperature, unit) : null,
      })),
    [points, unit],
  );

  const low = minC === null ? null : fromCelsius(minC, unit);
  const high = maxC === null ? null : fromCelsius(maxC, unit);

  const bands: Band[] = [];
  const rules: Rule[] = [];

  if (low !== null && high !== null) {
    bands.push({ key: "safe", y1: low, y2: high, color: "var(--ok)" });
  }
  if (low !== null) {
    rules.push({ key: "min", y: low, color: "var(--cold)", label: "Low limit" });
  }
  if (high !== null) {
    rules.push({ key: "max", y: high, color: "var(--hot)", label: "High limit" });
  }

  return (
    <TimeSeriesChart
      points={converted}
      series={[
        { key: "temperature", label: "Temperature", color: "var(--series-1)" },
      ]}
      unit={unitLabel(unit)}
      rangeKey={rangeKey}
      precision={1}
      height={280}
      bands={bands}
      rules={rules}
      dots
      /* A fix that omitted `temperature` is a gap in reporting, not a gap in
         the world, so the line bridges it rather than breaking. */
      connectNulls
      /* Temperature has no meaningful zero on either scale, and anchoring at 0
         would flatten a 20-24 °C day into a flat line near the top. */
      yDomainOverride={["auto", "auto"]}
    />
  );
}
