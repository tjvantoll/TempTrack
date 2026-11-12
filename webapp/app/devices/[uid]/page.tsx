import { AlertsTimeline } from "@/components/AlertsTimeline";
import { Card } from "@/components/Card";
import { ErrorNotice } from "@/components/ErrorNotice";
import { LocationPanel } from "@/components/LocationPanel";
import { SessionTable } from "@/components/SessionTable";
import { StatTile } from "@/components/StatTile";
import { TemperatureTile } from "@/components/Temperature";
import { TimeRangePicker } from "@/components/TimeRangePicker";
import { SessionCharts } from "@/components/charts/SessionCharts";
import { TempChart } from "@/components/charts/TempChart";
import { SESSION_CHART_KEYS, sessionFieldDef } from "@/lib/fields";
import { activeRange } from "@/lib/env-vars";
import {
  NotehubApiError,
  fetchAlerts,
  fetchLatestEvents,
  fetchSessionSamples,
  fetchTrackPoints,
  findDevice,
  getEnvironmentVariables,
  trackTemperatureSeries,
  type AlertSample,
  type SessionSample,
  type TrackPoint,
} from "@/lib/notehub";
import { decodeDeviceParam } from "@/lib/device-url";
import { latestValue, type Point } from "@/lib/series";
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

export default async function DashboardPage({
  params,
  searchParams,
}: PageProps<"/devices/[uid]">) {
  const [{ uid }, query] = await Promise.all([params, searchParams]);
  const range = resolveRange(query.range);

  // The layout has already resolved this device (and rendered any error or
  // not-found), and `listDevices` is request-cached, so this costs no request.
  const resolved = await findDevice(decodeDeviceParam(uid)).catch(() => null);
  if (!resolved) return null;
  const { device } = resolved;

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

  const { minC, maxC } = activeRange(variables);

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
      {/* ------------------------------------------------- At a glance --- */}
      <section aria-labelledby="glance-heading" className="space-y-4">
        <h2 id="glance-heading" className="sr-only">
          Current state
        </h2>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          <TemperatureTile
            label="Temperature"
            celsius={temperatureC}
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

        <LocationPanel points={trackPoints} />
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
