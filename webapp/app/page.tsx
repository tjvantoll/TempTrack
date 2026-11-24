import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { ErrorNotice, SetupNotice } from "@/components/ErrorNotice";
import { FleetMapPanel } from "@/components/FleetMapPanel";
import { Temperature } from "@/components/Temperature";
import { UnitToggle } from "@/components/UnitToggle";
import { deviceHref, deviceName } from "@/lib/device-url";
import { activeRange } from "@/lib/env-vars";
import { CURRENT_JOURNEY_MS, type FleetDevice, type FleetJourney } from "@/lib/fleet";
import {
  NotehubApiError,
  NotehubConfigError,
  fetchFleetAlerts,
  fetchFleetTrackPoints,
  getEnvironmentVariables,
  listDevices,
  type AlertSample,
  type DeviceSummary,
  type TrackPoint,
} from "@/lib/notehub";
import { formatRelative } from "@/lib/time-ranges";
import { formatDistance, pathLengthMeters } from "@/lib/track";

export const dynamic = "force-dynamic";

/**
 * How far back the fleet view reads `_track.qo`. A parked Notecard still
 * writes a heartbeat point every 24 hours, so this always reaches a device's
 * newest point; it also covers any journey a device could still be on.
 */
const TRACK_WINDOW_SEC = 25 * 3600;

/** How far back the fleet view looks for a device's latest alert. */
const ALERT_WINDOW_SEC = 30 * 24 * 3600;

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseIso(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * The journey a device is on right now, or null.
 *
 * Current means the newest tracking event belongs to a journey and arrived
 * recently (see CURRENT_JOURNEY_MS). A stationary device's heartbeat notes
 * carry no journey ID, so they correctly end any earlier trip.
 */
function currentJourney(points: TrackPoint[]): FleetJourney | null {
  const newest = points[points.length - 1];
  const id = num(newest?.fields["journey"]);
  if (id === null || Date.now() - newest.t > CURRENT_JOURNEY_MS) return null;

  const journey = points.filter((point) => point.fields["journey"] === id);
  return {
    id,
    startedMs: id * 1000,
    path: journey.map((point) => [point.lat, point.lon]),
    distanceM: pathLengthMeters(journey),
  };
}

/**
 * Whether the device's newest alert still stands.
 *
 * The question is about the newest reading, not the alert: a tracking event
 * after the alert supersedes it, and if there is none the alert's own reading
 * is still the latest word. That reading is judged against the range the
 * device runs on now — so turning a side off, or widening the band, clears an
 * alert the new settings would not have raised. If the settings could not be
 * read, the thresholds the alert itself carried stand in for them.
 */
function alertState(
  alert: NonNullable<FleetDevice["latestAlert"]> & { minC: number | null; maxC: number | null },
  reading: { t: number; tempC: number } | null,
  variables: Record<string, string> | null,
): FleetDevice["alertState"] {
  const latest = reading && reading.t > alert.t ? reading.tempC : alert.tempC;
  const { minC, maxC } = variables ? activeRange(variables) : alert;
  const outside = (minC !== null && latest < minC) || (maxC !== null && latest > maxC);
  return outside ? "active" : "cleared";
}

/** What the fleet-wide queries returned; null when they failed. */
type FleetData = {
  tracks: Map<string, TrackPoint[]>;
  alerts: Map<string, AlertSample[]>;
} | null;

/**
 * One request per notefile for the whole fleet, not one per device: Notehub's
 * API rate limit is per billing account and small (7 requests a minute on the
 * default plan), so per-device requests fail once a fleet has a few devices.
 * Null when either request fails, so every row reads "Unavailable", not "none".
 */
async function loadFleetData(): Promise<FleetData> {
  const nowSec = Math.ceil(Date.now() / 1000);
  try {
    const [tracks, alerts] = await Promise.all([
      fetchFleetTrackPoints({ startSec: nowSec - TRACK_WINDOW_SEC, endSec: nowSec }),
      fetchFleetAlerts({ startSec: nowSec - ALERT_WINDOW_SEC, endSec: nowSec }),
    ]);
    return { tracks, alerts };
  } catch {
    return null;
  }
}

/**
 * Fill in one device's row from the fleet-wide queries; the location comes
 * from the device record. Only a device with an alert costs a request of its
 * own, for the settings that decide whether the alert still stands.
 *
 * The temperature deliberately comes only from `_track.qo` — the device
 * record's `temperature` is the Notecard's own reading, a different sensor.
 */
async function fleetDevice(device: DeviceSummary, data: FleetData): Promise<FleetDevice> {
  const base: FleetDevice = {
    uid: device.uid,
    name: deviceName(device),
    location: device.location,
    lat: device.lat,
    lon: device.lon,
    locationMs: parseIso(device.locationWhen),
    lastActivityMs: parseIso(device.lastActivity),
    temperatureC: null,
    temperatureMs: null,
    latestAlert: null,
    alertState: null,
    journey: null,
    detailsUnavailable: false,
  };

  // The fleet-wide queries failing should not blank the whole fleet.
  if (!data) return { ...base, detailsUnavailable: true };

  const points = data.tracks.get(device.uid) ?? [];
  const track = points[points.length - 1];
  const alerts = data.alerts.get(device.uid) ?? [];
  const alert = alerts[alerts.length - 1];

  const temperatureC = num(track?.fields["temperature"]);
  let latestAlert: FleetDevice["latestAlert"] = null;
  let state: FleetDevice["alertState"] = null;
  if (alert) {
    latestAlert = { t: alert.t, tempC: alert.tempC, direction: alert.direction };
    // Only needed to judge the alert, which has a fallback without it.
    const variables = await getEnvironmentVariables(device.uid).catch(() => null);
    const reading = temperatureC !== null && track ? { t: track.t, tempC: temperatureC } : null;
    state = alertState({ ...latestAlert, minC: alert.minC, maxC: alert.maxC }, reading, variables);
  }

  const journey = currentJourney(points);
  const lastFix = journey?.path[journey.path.length - 1];

  return {
    ...base,
    // Mid-trip, the newest fix is a better "where is it now" than the device
    // record, and it keeps the marker on the end of the drawn line.
    ...(lastFix ? { lat: lastFix[0], lon: lastFix[1] } : {}),
    journey,
    temperatureC,
    temperatureMs: temperatureC !== null ? (track?.t ?? null) : null,
    latestAlert,
    alertState: state,
  };
}

export default async function FleetPage({ searchParams }: PageProps<"/">) {
  const query = await searchParams;

  // Links from before the fleet view picked a device with `?device=`.
  const legacyDevice = Array.isArray(query.device) ? query.device[0] : query.device;
  if (legacyDevice) redirect(deviceHref(legacyDevice));

  let summaries: DeviceSummary[];
  try {
    summaries = await listDevices();
  } catch (error) {
    if (error instanceof NotehubConfigError) return <SetupNotice message={error.message} />;
    if (error instanceof NotehubApiError) {
      return <ErrorNotice title="Could not reach Notehub" message={error.message} />;
    }
    throw error;
  }

  if (!summaries.length) {
    return (
      <ErrorNotice
        title="No devices in this project"
        message="Notehub returned no devices for this project UID."
        hint="Check that NOTEHUB_PROJECT_UID points at the project your TempTrack devices report into."
      />
    );
  }

  const data = await loadFleetData();
  const devices = (await Promise.all(summaries.map((device) => fleetDevice(device, data)))).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  const alerting = devices.filter((d) => d.alertState === "active").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Fleet</h1>
          <p className="text-sm text-muted">
            {devices.length === 1 ? "1 device" : `${devices.length} devices`}
            {alerting > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--alert-ink)" }}>
                  {alerting === 1 ? "1 with an active alert" : `${alerting} with active alerts`}
                </span>
              </>
            )}
          </p>
        </div>
        <UnitToggle />
      </div>

      <FleetMapPanel devices={devices} />

      <Card title="Devices" subtitle="Select a device for its dashboard and settings." bodyClassName="!p-0">
        <ul className="divide-y divide-line">
          {devices.map((device) => {
            const active = device.alertState === "active";
            return (
              <li key={device.uid}>
                <Link
                  href={deviceHref(device.uid)}
                  className="grid gap-x-6 gap-y-2 px-5 py-4 transition-colors hover:bg-surface-alt sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      <span
                        aria-hidden
                        className="inline-block size-2.5 shrink-0 rounded-full"
                        style={{ background: active ? "var(--accent)" : "var(--secondary)" }}
                      />
                      <span className="truncate">{device.name}</span>
                    </p>
                    <p className="truncate text-sm text-muted">{device.location ?? "No location yet"}</p>
                    {device.journey && (
                      <p className="mt-1 text-sm font-medium text-primary">
                        On a journey · {formatDistance(device.journey.distanceM)} · started{" "}
                        {formatRelative(device.journey.startedMs)}
                      </p>
                    )}
                  </div>

                  <Stat label="Temperature">
                    {device.temperatureC !== null ? (
                      <span className="tnum">
                        <Temperature celsius={device.temperatureC} />
                      </span>
                    ) : (
                      <span className="text-muted">{device.detailsUnavailable ? "Unavailable" : "—"}</span>
                    )}
                  </Stat>

                  <Stat label="Last alert">
                    {device.latestAlert ? (
                      <span className="inline-flex flex-wrap items-baseline justify-end gap-x-2 sm:justify-start">
                        <span style={active ? { color: "var(--alert-ink)" } : undefined}>
                          {formatRelative(device.latestAlert.t)}
                          {device.latestAlert.direction !== "unknown" &&
                            ` · ${device.latestAlert.direction === "hot" ? "too hot" : "too cold"}`}
                        </span>
                        <AlertBadge state={device.alertState} />
                      </span>
                    ) : (
                      <span className="text-muted">{device.detailsUnavailable ? "Unavailable" : "None"}</span>
                    )}
                  </Stat>

                  <Stat label="Last seen">
                    {device.lastActivityMs !== null ? (
                      formatRelative(device.lastActivityMs)
                    ) : (
                      <span className="text-muted">Never</span>
                    )}
                  </Stat>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm sm:block">
      <p className="text-xs text-muted sm:mb-0.5">{label}</p>
      <p className="text-ink">{children}</p>
    </div>
  );
}

/**
 * Spelled out as well as colored, so whether an alert still stands never
 * depends on telling red from blue.
 */
function AlertBadge({ state }: { state: FleetDevice["alertState"] }) {
  if (!state) return null;
  const active = state === "active";
  return (
    <span
      className="rounded-full px-2 py-px text-xs font-medium"
      style={{
        color: active ? "var(--alert-ink)" : "var(--ok-ink)",
        background: `color-mix(in srgb, ${active ? "var(--alert)" : "var(--ok)"} 14%, transparent)`,
      }}
    >
      {active ? "Active" : "Cleared"}
    </span>
  );
}
