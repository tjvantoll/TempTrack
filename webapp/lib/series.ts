/**
 * Turning Notehub events into chart-ready series.
 *
 * Two device-specific facts drive this module:
 *
 * 1. The Notecard runs `hub.set mode:periodic` with voltage-variable outbound
 *    intervals (firmware/src/config.cpp:16), so several readings captured hours
 *    apart arrive in a single upload. Everything here keys off *captured* time
 *    (`when`), never receipt time, and a batch must fan out across the axis.
 * 2. A genuinely missed reading should read as a gap, not as a straight line
 *    interpolated across it, so a null-valued spacer is inserted when the
 *    interval between samples jumps well past the norm.
 */

export type Point = { t: number } & Record<string, number | null>;

export type SeriesSummary = {
  min: number;
  max: number;
  avg: number;
  last: number | null;
  count: number;
};

/** Multiple of the typical sample interval that counts as a gap. */
const GAP_FACTOR = 3;
/** Never treat anything under this as a gap, however fast the device samples. */
const MIN_GAP_MS = 15 * 60 * 1000;

export function medianInterval(points: Point[]): number | null {
  if (points.length < 3) return null;
  const deltas: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const d = points[i].t - points[i - 1].t;
    if (d > 0) deltas.push(d);
  }
  if (!deltas.length) return null;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)];
}

/**
 * Insert an all-null spacer wherever the capture gap exceeds the norm, so a
 * chart with `connectNulls={false}` breaks the line instead of drawing a
 * straight segment across an outage.
 */
export function insertGaps(points: Point[], keys: string[]): Point[] {
  if (points.length < 3) return points;
  const median = medianInterval(points);
  if (!median) return points;
  const threshold = Math.max(median * GAP_FACTOR, MIN_GAP_MS);

  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i > 0 && points[i].t - points[i - 1].t > threshold) {
      const spacer: Point = { t: Math.round((points[i].t + points[i - 1].t) / 2) };
      for (const key of keys) spacer[key] = null;
      out.push(spacer);
    }
    out.push(points[i]);
  }
  return out;
}

/**
 * Thin a dense series while keeping its envelope: each time bucket contributes
 * the real rows carrying that bucket's min and max of `primaryKey`. Rows are
 * emitted intact, so every other series stays consistent with the row it came
 * from rather than being averaged into something never measured.
 */
export function downsample(points: Point[], primaryKey: string, maxPoints = 900): Point[] {
  if (points.length <= maxPoints) return points;

  const first = points[0].t;
  const last = points[points.length - 1].t;
  const span = last - first;
  if (span <= 0) return points;

  const bucketCount = Math.max(1, Math.floor(maxPoints / 2));
  const bucketMs = span / bucketCount;

  const kept: Point[] = [];
  let bucketStart = first;
  let lo: Point | null = null;
  let hi: Point | null = null;

  const flush = () => {
    if (!lo && !hi) return;
    const picks = lo === hi || !hi ? [lo!] : [lo!, hi];
    picks.sort((a, b) => a.t - b.t);
    for (const p of picks) if (!kept.length || kept[kept.length - 1] !== p) kept.push(p);
    lo = null;
    hi = null;
  };

  for (const point of points) {
    while (point.t >= bucketStart + bucketMs) {
      flush();
      bucketStart += bucketMs;
    }
    const value = point[primaryKey];
    if (value === null || value === undefined) {
      // Gap spacers are structural — keep them so breaks survive thinning.
      flush();
      kept.push(point);
      continue;
    }
    if (!lo || (lo[primaryKey] as number) > value) lo = point;
    if (!hi || (hi[primaryKey] as number) < value) hi = point;
  }
  flush();

  return kept;
}

export function summarize(points: Point[], key: string): SeriesSummary | null {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  let last: number | null = null;

  for (const point of points) {
    const value = point[key];
    if (typeof value !== "number" || Number.isNaN(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
    count += 1;
    last = value;
  }

  if (!count) return null;
  return { min, max, avg: sum / count, last, count };
}

/** Latest non-null value for a key, scanning from the end. */
export function latestValue(points: Point[], key: string): { value: number; t: number } | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const value = points[i][key];
    if (typeof value === "number" && !Number.isNaN(value)) {
      return { value, t: points[i].t };
    }
  }
  return null;
}
