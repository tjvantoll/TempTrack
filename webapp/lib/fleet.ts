
/**
 * How recently a device must have reported a journey's tracking event for that
 * journey to count as in progress.
 *
 * The Notecard never sends a "journey ended" note — it simply stops writing
 * tracking events once the device has been still for `_gps_journey_secs` (5 min
 * by default). So "current" can only be judged by recency. While moving, the
 * firmware tracks every 5 minutes (firmware/src/config.cpp), so this allows a
 * few missed reports plus sync delay before the trip is treated as over.
 */
export const CURRENT_JOURNEY_MS = 30 * 60 * 1000;

export type FleetJourney = {
  /** The journey's ID, which is also when it started (UNIX seconds). */
  id: number;
  startedMs: number;
  /** Every fix in the journey so far, oldest first. */
  path: [number, number][];
  distanceM: number;
};

/**
 * One device as the fleet view sees it. Plain data, so it can be handed to the
 * client-side map as-is.
 */
export type FleetDevice = {
  uid: string;
  name: string;
  location: string | null;
  lat: number | null;
  lon: number | null;
  /** When the position above was taken, in ms. */
  locationMs: number | null;
  lastActivityMs: number | null;
  /** From the newest `_track.qo` event — the product's own temperature sensor. */
  temperatureC: number | null;
  temperatureMs: number | null;
  latestAlert: { t: number; tempC: number; direction: "hot" | "cold" | "unknown" } | null;
  /**
   * Whether that alert still stands. `active` while the newest temperature
   * reading is outside the device's current range; `cleared` once a reading
   * since has come back inside it. Null when the device has never alerted.
   */
  alertState: "active" | "cleared" | null;
  /** The trip the device is on right now, if any. */
  journey: FleetJourney | null;
  /** True when the per-device lookup failed, so blanks mean "unknown" not "none". */
  detailsUnavailable: boolean;
};

export type FleetMapProps = { devices: FleetDevice[] };
