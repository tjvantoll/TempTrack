import { AlertsTimeline } from "@/components/AlertsTimeline";
import { Card } from "@/components/Card";
import { DeviceSwitcher } from "@/components/DeviceSwitcher";
import { ErrorNotice, SetupNotice } from "@/components/ErrorNotice";
import { LocationPanel } from "@/components/LocationPanel";
import { SessionTable } from "@/components/SessionTable";
import { StatTile } from "@/components/StatTile";
import { TimeRangePicker } from "@/components/TimeRangePicker";
import { UnitToggle } from "@/components/UnitToggle";
import { SessionCharts } from "@/components/charts/SessionCharts";
import { TempChart } from "@/components/charts/TempChart";
import { SESSION_CHART_KEYS, sessionFieldDef } from "@/lib/fields";
import {
  TEMP_MAX_DEFAULT,
  TEMP_MAX_DISABLED,
  TEMP_MAX_VAR,
  TEMP_MIN_DEFAULT,
  TEMP_MIN_DISABLED,
  TEMP_MIN_VAR,
} from "@/lib/env-vars";
import {
  NotehubApiError,
  NotehubConfigError,
  fetchAlerts,
  fetchLatestEvents,
  fetchSessionSamples,
  fetchTrackPoints,
  getEnvironmentVariables,
  resolveDevice,
  trackTemperatureSeries,
  type AlertSample,
  type SessionSample,
  type TrackPoint,
} from "@/lib/notehub";
import { latestValue, type Point } from "@/lib/series";
import { fromCelsius, resolveUnit, unitLabel } from "@/lib/temperature";
import { formatRelative, resolveRange } from "@/lib/time-ranges";
import { formatDistance, pathLengthMeters } from "@/lib/track";

// Every load goes straight to Notehub — nothing here is cached.
export const dynamic = "force-dynamic";

/**
 * Current state must never depend on the selected window, or choosing 24h on a
 * quiet day would blank the page. This matters more here than on a periodic
 * sensor: a stationary TempTrack reports one heartbeat a day and may not alert
 * for weeks, so "nothing in the window" is the healthy case.
 */
const CURRENT_WINDOW_SEC = 30 * 24 * 60 * 60;

function sessionPoints(samples: SessionSample[]): Point[] {
  return samples.map((sample) => {
    const point: Point = { t: sample.t };
    for (const key of SESSION_CHART_KEYS) {
      const value = sample.fields[key];
      point[key] = typeof value === "number" ? value : null;
    }
    return point;
  });
}

/**
 * A configured threshold, or null where that direction is switched off. The
 * firmware stores "off" as an unreachable temperature rather than a flag, so
 * the sentinel has to be filtered out before anything tries to draw it.
 */
function activeThreshold(
  variables: Record<string, string>,
  name: string,
  fallback: number,
  sentinel: number,
): number | null {
  const raw = variables[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value === sentinel) return null;
  return value;
}

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const range = resolveRange(params.range);
  const unit = resolveUnit(params.unit);
  const requestedDevice = Array.isArray(params.device)
    ? params.device[0]
    : params.device;

  let resolved: Awaited<ReturnType<typeof resolveDevice>> = null;
  let failure: Error | null = null;
  try {
    resolved = await resolveDevice(requestedDevice);
  } catch (error) {
    if (
      error instanceof NotehubConfigError ||
      error instanceof NotehubApiError
    ) {
      failure = error;
    } else {
      throw error;
    }
  }

  if (failure instanceof NotehubConfigError)
    return <SetupNotice message={failure.message} />;
  if (failure)
    return (
      <ErrorNotice title="Could not reach Notehub" message={failure.message} />
    );

  if (!resolved) {
    return (
      <ErrorNotice
        title="No devices in this project"
        message="Notehub returned no devices for this project UID."
        hint="Check that NOTEHUB_PROJECT_UID points at the project your TempTrack device reports into."
      />
    );
  }

  const { device, all } = resolved;

  // One request per notefile covers the wider of the two windows; each section
  // slices what it needs.
  const wideStartSec = Math.min(
    range.startSec,
    range.endSec - CURRENT_WINDOW_SEC,
  );

  let trackPoints: TrackPoint[];
  let alerts: AlertSample[];
  let sessions: SessionSample[];
  let variables: Record<string, string> = {};
  try {
    [trackPoints, alerts, sessions, variables] = await Promise.all([
      fetchTrackPoints({
        deviceUid: device.uid,
        startSec: range.startSec,
        endSec: range.endSec,
      }),
      fetchAlerts({
        deviceUid: device.uid,
        startSec: wideStartSec,
        endSec: range.endSec,
      }),
      fetchSessionSamples({
        deviceUid: device.uid,
        startSec: wideStartSec,
        endSec: range.endSec,
      }),
      // Thresholds are chrome around the chart, not the chart itself. If the
      // read fails the page still renders, just without the band drawn.
      getEnvironmentVariables(device.uid).catch(() => ({})),
    ]);
  } catch (error) {
    if (error instanceof NotehubApiError) {
      return (
        <ErrorNotice
          title="Could not load device data"
          message={error.message}
        />
      );
    }
    throw error;
  }

  // Best-effort, and never fatal — it only backfills the tiles.
  const latestEvents = await fetchLatestEvents(device.uid).catch(() => []);

  /* ------------------------------------------------------- current state */

  const minC = activeThreshold(
    variables,
    TEMP_MIN_VAR,
    TEMP_MIN_DEFAULT,
    TEMP_MIN_DISABLED,
  );
  const maxC = activeThreshold(
    variables,
    TEMP_MAX_VAR,
    TEMP_MAX_DEFAULT,
    TEMP_MAX_DISABLED,
  );

  const allSessionPoints = sessionPoints(sessions);
  const currentVoltage = latestValue(allSessionPoints, "voltage");
  const currentRssi = latestValue(allSessionPoints, "rssi");

  const latestAlert = alerts.length ? alerts[alerts.length - 1] : null;
  const windowAlerts = alerts.filter(
    (alert) => alert.t >= range.startSec * 1000,
  );

  const latestTrack = trackPoints.length
    ? trackPoints[trackPoints.length - 1]
    : null;
  const latestTrackEvent = latestEvents.find(
    (event) => event.file === "_track.qo",
  );

  /**
   * Temperature at the newest tracking event in the window, falling back to the
   * most recent event on record when the window itself is empty.
   *
   * Both come from a `_track.qo` body. Neither the device record's `temperature`
   * nor the event-level `temp` is used as a further fallback: those are the
   * Notecard's own reading, and filling this tile from them would put a
   * different sensor's number under the same label without saying so.
   */
  const temperatureC =
    (typeof latestTrack?.fields["temperature"] === "number"
      ? latestTrack.fields["temperature"]
      : null) ??
    (typeof latestTrackEvent?.body["temperature"] === "number"
      ? (latestTrackEvent.body["temperature"] as number)
      : null);

  const tempPoints = trackTemperatureSeries(trackPoints);
  const pathLength = pathLengthMeters(trackPoints);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">
          {device.serialNumber || device.bestId || "TempTrack device"}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <UnitToggle value={unit} />
          <DeviceSwitcher devices={all} selected={device.uid} />
        </div>
      </div>

      {/* ------------------------------------------------- At a glance --- */}
      <section aria-labelledby="glance-heading" className="space-y-4">
        <h2 id="glance-heading" className="sr-only">
          Current state
        </h2>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="Temperature"
            value={
              temperatureC === null ? null : fromCelsius(temperatureC, unit)
            }
            unit={unitLabel(unit)}
            precision={1}
            note={
              latestTrack
                ? `At the latest tracking event · ${formatRelative(latestTrack.t)}`
                : latestTrackEvent?.t
                  ? `Most recent tracking event · ${formatRelative(latestTrackEvent.t)}`
                  : undefined
            }
          />
          <StatTile
            label={sessionFieldDef("voltage").label}
            value={currentVoltage?.value ?? device.voltage ?? null}
            unit="V"
            precision={2}
            note={
              currentVoltage
                ? `Session · ${formatRelative(currentVoltage.t)}`
                : "From the device record"
            }
          />
          <StatTile
            label={sessionFieldDef("rssi").label}
            value={currentRssi?.value ?? null}
            unit="dBm"
            note={
              currentRssi
                ? `Session · ${formatRelative(currentRssi.t)}`
                : undefined
            }
          />
        </div>
      </section>

      {/* ---------------------------------------------------- Location --- */}
      <section aria-labelledby="location-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="location-heading"
              className="text-lg font-semibold text-ink"
            >
              Location
            </h2>
            <p className="text-sm text-muted">
              Last {range.label} ·{" "}
              {trackPoints.length === 1
                ? "1 tracking event"
                : `${trackPoints.length.toLocaleString()} tracking events`}
              {trackPoints.length > 1 && ` · ${formatDistance(pathLength)}`}
            </p>
          </div>
          <TimeRangePicker value={range.key} />
        </div>

        <LocationPanel points={trackPoints} unit={unit} />
      </section>

      {/* ------------------------------------------------- Temperature --- */}
      <section aria-labelledby="temperature-heading" className="space-y-4">
        <h2 id="temperature-heading" className="text-lg font-semibold text-ink">
          Temperature
        </h2>

        <Card
          title="Alerts"
          subtitle="The device reports when temperature leaves the configured range."
        >
          <AlertsTimeline
            alerts={windowAlerts}
            latest={latestAlert}
            unit={unit}
            rangeLabel={range.label}
          />
        </Card>

        <Card
          title="Temperature Readings"
          subtitle="Reported with every tracking event."
          footnote={
            minC !== null || maxC !== null
              ? "The shaded band and dashed limits show the range configured right now. Past alerts carry the range that was in force when they fired."
              : undefined
          }
        >
          <TempChart
            points={tempPoints}
            rangeKey={range.key}
            unit={unit}
            minC={minC}
            maxC={maxC}
          />
        </Card>
      </section>

      {/* ------------------------------------------------ Connectivity --- */}
      <section aria-labelledby="connectivity-heading" className="space-y-4">
        <h2
          id="connectivity-heading"
          className="text-lg font-semibold text-ink"
        >
          Connectivity
        </h2>

        <Card
          title="Cellular and power"
          subtitle="Telemetry from the device's _session.qo reports, one slot per session."
        >
          <SessionCharts
            points={sessionPoints(
              sessions.filter((s) => s.t >= range.startSec * 1000),
            )}
            rangeKey={range.key}
          />
          <div className="mt-6 border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-semibold text-ink">
              Latest session
            </h3>
            <SessionTable
              sample={sessions.length ? sessions[sessions.length - 1] : null}
            />
          </div>
        </Card>
      </section>
    </div>
  );
}
