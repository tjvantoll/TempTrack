export const RANGES = [
  { key: "24h", label: "24 hours", short: "24h", seconds: 24 * 60 * 60 },
  { key: "3d", label: "3 days", short: "3d", seconds: 3 * 24 * 60 * 60 },
  { key: "7d", label: "7 days", short: "7d", seconds: 7 * 24 * 60 * 60 },
  { key: "30d", label: "30 days", short: "30d", seconds: 30 * 24 * 60 * 60 },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

/**
 * A week, not a day. A stationary TempTrack reports one `_track.qo` heartbeat
 * every 24 hours (firmware/src/config.cpp:32-38) and checks temperature only
 * while moving, so a 24-hour default lands on an empty page for a device
 * behaving perfectly normally.
 */
export const DEFAULT_RANGE: RangeKey = "7d";

export type ResolvedRange = {
  key: RangeKey;
  label: string;
  short: string;
  seconds: number;
  startSec: number;
  endSec: number;
};

export function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === "string" && RANGES.some((r) => r.key === value);
}

export function resolveRange(param: string | string[] | undefined, now = Date.now()): ResolvedRange {
  const raw = Array.isArray(param) ? param[0] : param;
  const key: RangeKey = isRangeKey(raw) ? raw : DEFAULT_RANGE;
  const range = RANGES.find((r) => r.key === key)!;
  const endSec = Math.floor(now / 1000);
  return {
    key,
    label: range.label,
    short: range.short,
    seconds: range.seconds,
    startSec: endSec - range.seconds,
    endSec,
  };
}

/** Axis tick format that stays readable as the window widens. */
export function axisTimeFormat(rangeKey: RangeKey): Intl.DateTimeFormatOptions {
  if (rangeKey === "24h") return { hour: "numeric", minute: "2-digit" };
  if (rangeKey === "3d") return { weekday: "short", hour: "numeric" };
  return { month: "short", day: "numeric" };
}

export function formatRelative(fromMs: number, now = Date.now()): string {
  const diffSec = Math.round((now - fromMs) / 1000);
  if (diffSec < 60) return "just now";
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}
