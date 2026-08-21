/**
 * Display metadata for the values this dashboard renders.
 *
 * TempTrack reads three notefiles and none of them is a fixed-shape telemetry
 * feed, so this registry exists to give every field a human label, a unit, and
 * a sane precision — and to make an unrecognised field render generically
 * rather than vanish.
 */

export function seriesColor(slot: number): string {
  return `var(--series-${((slot - 1) % 6) + 1})`;
}

/* ------------------------------------------------------------------- track */

/**
 * `_track.qo` fields, produced by the Notecard's own tracking rather than by
 * TempTrack's firmware (firmware/src/config.cpp:32-38). The set that actually
 * arrives varies by event: a `heartbeat` note from a stationary device carries
 * far less than a `moved` note with a fresh GPS lock.
 */
export type TrackFieldDef = {
  label: string;
  unit?: string;
  precision?: number;
  description?: string;
  /**
   * Render the digits as-is. For an identifier, thousands separators invent a
   * magnitude the value does not have — journey 1755400000 is a name, not
   * 1.76 billion of anything.
   */
  plain?: boolean;
};

export const TRACK_FIELDS: Record<string, TrackFieldDef> = {
  lat: { label: "Latitude", unit: "\u00b0", precision: 5 },
  lon: { label: "Longitude", unit: "\u00b0", precision: 5 },
  status: {
    label: "Reason",
    description:
      "Why the Notecard recorded this event \u2014 movement, the 24-hour heartbeat, or a failure to see satellites.",
  },
  motion: {
    label: "Motion events",
    precision: 0,
    description: "Accelerometer events counted in the bucket leading up to this event.",
  },
  distance: {
    label: "Distance",
    unit: "m",
    precision: 0,
    description: "Straight-line distance from the previous event.",
  },
  velocity: { label: "Speed", unit: "m/s", precision: 1 },
  bearing: { label: "Heading", unit: "\u00b0", precision: 0 },
  seconds: {
    label: "Time since previous event",
    unit: "s",
    precision: 0,
  },
  temperature: {
    label: "Temperature",
    unit: "\u00b0C",
    precision: 1,
    description: "Reported with every tracking event.",
  },
  voltage: { label: "Voltage", unit: "V", precision: 2 },
  hdop: {
    label: "Location precision (HDOP)",
    precision: 1,
    description: "Horizontal dilution of precision. Lower is tighter; under 2 is good.",
  },
  dop: { label: "Location precision (DOP)", precision: 1 },
  journey: {
    label: "Journey",
    plain: true,
    description: "Identifier the Notecard assigns to a run of movement.",
  },
  jcount: { label: "Position in journey", precision: 0 },
  usb: { label: "USB power" },
  charging: { label: "Charging" },
  heartbeat: { label: "Heartbeat" },
};

/**
 * Track detail rows, in display order. Anything else falls through generically.
 *
 * Temperature leads: it is the reading the product exists to report, and the
 * fields after it describe the tracking event that carried it.
 */
export const TRACK_DETAIL_KEYS = [
  "temperature",
  "status",
  "velocity",
  "bearing",
  "distance",
  "motion",
  "hdop",
  "voltage",
  "journey",
] as const;

export function trackFieldDef(key: string): TrackFieldDef {
  return TRACK_FIELDS[key] ?? { label: humanizeKey(key) };
}

/* ------------------------------------------------------------------ session */

/**
 * `_session.qo` telemetry. Notehub attaches some of these at the event's top
 * level and some inside the note body; the UI merges both and renders anything
 * it does not recognise generically, so a Notecard firmware update that adds a
 * field shows up instead of being silently dropped.
 */
export type SessionFieldDef = {
  label: string;
  unit?: string;
  precision?: number;
  /** Charted as its own small multiple when true. */
  chartable?: boolean;
  description?: string;
  /** Rendered as a date rather than a bare number. */
  kind?: "timestamp";
  /**
   * Natural axis range, where the metric has one. Without this these plots
   * anchor at zero, which flattens a narrow-range signal into a straight line.
   */
  domain?: [number | string, number | string];
};

export const SESSION_FIELDS: Record<string, SessionFieldDef> = {
  rssi: {
    label: "Signal strength (RSSI)",
    unit: "dBm",
    precision: 0,
    chartable: true,
    domain: ["auto", "auto"],
    description:
      "Received signal strength. Closer to 0 is stronger; below -100 dBm is weak.",
  },
  sinr: {
    label: "Signal quality (SINR)",
    unit: "dB",
    precision: 0,
    chartable: true,
    domain: ["auto", "auto"],
    description: "Signal to interference-plus-noise ratio. Higher is cleaner.",
  },
  rsrp: { label: "RSRP", unit: "dBm", precision: 0, chartable: true },
  rsrq: { label: "RSRQ", unit: "dB", precision: 0, chartable: true },
  bars: {
    label: "Signal bars",
    unit: "",
    precision: 0,
    chartable: true,
    // The Notecard reports 0-4; a fixed scale keeps a steady signal readable.
    domain: [0, 4],
    description: "Notecard's 0-4 summary of signal quality.",
  },
  voltage: {
    label: "Voltage",
    unit: "V",
    precision: 2,
    chartable: true,
    domain: ["auto", "auto"],
    description: "Supply voltage.",
  },
  secs: { label: "Session length", unit: "s", precision: 0 },
  session_secs: { label: "Session length", unit: "s", precision: 0 },
  rat: { label: "Radio access technology" },
  bearer: { label: "Bearer" },
  band: { label: "Band" },
  apn: { label: "APN" },
  iccid: { label: "SIM ICCID" },
  imsi: { label: "IMSI" },
  modem: { label: "Modem firmware" },
  ip: { label: "IP address" },
  started_because: { label: "Started because" },
  ended_because: { label: "Ended because" },
  orientation: { label: "Orientation" },
  // Notecard reports this as the Unix time of the last detected movement,
  // not a running count.
  moved: { label: "Last moved", kind: "timestamp" },
  rx: { label: "Bytes received", unit: "B", precision: 0 },
  tx: { label: "Bytes sent", unit: "B", precision: 0 },
  tower_id: { label: "Tower ID" },
  tower_country: { label: "Tower country" },
  tower_location: { label: "Tower location" },
  cell: { label: "Cell" },
  continuous: { label: "Continuous mode" },
  power_charging: { label: "Charging" },
  power_usb: { label: "USB power" },
  power_mah: { label: "Power used", unit: "mAh", precision: 1 },
  failed_connects: { label: "Failed connects", precision: 0 },
};

/** Session fields charted as small multiples, in display order. */
export const SESSION_CHART_KEYS = ["rssi", "sinr", "bars", "voltage"] as const;

export function sessionFieldDef(key: string): SessionFieldDef {
  return SESSION_FIELDS[key] ?? { label: humanizeKey(key) };
}


export function humanizeKey(key: string): string {
  return key
    .replace(/^_+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatNumber(value: number, precision = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}
