import { formatTemp, type Unit } from "@/lib/temperature";
import { formatRelative } from "@/lib/time-ranges";
import { TEMP_MAX_DISABLED, TEMP_MIN_DISABLED } from "@/lib/env-vars";
import type { AlertSample } from "@/lib/notehub";

const fullFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const DIRECTION = {
  hot: { label: "Too hot", ink: "var(--hot-ink)", mark: "var(--hot)" },
  cold: { label: "Too cold", ink: "var(--cold-ink)", mark: "var(--cold)" },
  unknown: { label: "Out of range", ink: "var(--alert-ink)", mark: "var(--alert)" },
} as const;

/**
 * The band that was in force when an alert fired, worded rather than printed as
 * a pair of numbers — a sentinel bound is not a temperature and should not be
 * shown as one.
 */
function bandLabel(alert: AlertSample, unit: Unit): string {
  const lowActive = alert.minC !== null && alert.minC !== TEMP_MIN_DISABLED;
  const highActive = alert.maxC !== null && alert.maxC !== TEMP_MAX_DISABLED;

  if (lowActive && highActive) {
    return `Range was ${formatTemp(alert.minC!, unit, { precision: 0, withUnit: false })} to ${formatTemp(alert.maxC!, unit, { precision: 0 })}`;
  }
  if (highActive) return `Limit was ${formatTemp(alert.maxC!, unit, { precision: 0 })}`;
  if (lowActive) return `Limit was ${formatTemp(alert.minC!, unit, { precision: 0 })}`;
  return "No limit was set";
}

export function AlertsTimeline({
  alerts,
  latest,
  unit,
  rangeLabel,
}: {
  /** Alerts inside the selected window, oldest first. */
  alerts: AlertSample[];
  /** The most recent alert on record, which may predate the window. */
  latest: AlertSample | null;
  unit: Unit;
  rangeLabel: string;
}) {
  const newestFirst = [...alerts].reverse();

  return (
    <div className="space-y-5">
      {/* The hero reads the newest alert on record, not the newest in the
          window, so choosing a short range never makes it look like the device
          has never alerted. */}
      {latest ? (
        <div
          className="rounded-xl border border-line bg-surface-alt px-5 py-4"
          style={{ borderLeft: `4px solid ${DIRECTION[latest.direction].mark}` }}
        >
          <p className="text-sm text-muted">Most recent alert</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tnum text-3xl font-semibold text-ink">
              {formatTemp(latest.tempC, unit)}
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-sm font-medium"
              style={{
                color: DIRECTION[latest.direction].ink,
                background: `color-mix(in srgb, ${DIRECTION[latest.direction].mark} 16%, transparent)`,
              }}
            >
              {DIRECTION[latest.direction].label}
            </span>
            <time dateTime={new Date(latest.t).toISOString()} className="text-sm text-muted">
              {formatRelative(latest.t)}
            </time>
          </div>
          <p className="mt-1.5 text-sm text-muted">{bandLabel(latest, unit)}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface-alt px-5 py-4">
          <p className="text-sm font-medium text-ink">No temperature alerts on record.</p>
          <p className="mt-1 text-sm text-muted">
            Nothing has gone outside the configured range, which is the outcome you want. The device
            only checks temperature while it is moving, so a tracker that has been sitting still has
            had nothing to report.
          </p>
        </div>
      )}

      {newestFirst.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">
            {newestFirst.length === 1
              ? `1 alert in the last ${rangeLabel}`
              : `${newestFirst.length} alerts in the last ${rangeLabel}`}
          </h3>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <caption className="sr-only">Temperature alerts in the selected window</caption>
              <thead className="sticky top-0 bg-surface-alt">
                <tr className="text-left text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">
                    When
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Temperature
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Why
                  </th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.map((alert) => (
                  <tr key={`${alert.t}-${alert.tempC}`} className="border-t border-line">
                    <td className="tnum whitespace-nowrap px-3 py-2 text-muted">
                      <time dateTime={new Date(alert.t).toISOString()}>
                        {fullFormat.format(alert.t)}
                      </time>
                    </td>
                    <td className="tnum whitespace-nowrap px-3 py-2 font-medium text-ink">
                      {formatTemp(alert.tempC, unit)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="font-medium"
                        style={{ color: DIRECTION[alert.direction].ink }}
                      >
                        {DIRECTION[alert.direction].label}
                      </span>
                      <span className="ml-2 text-muted">{bandLabel(alert, unit)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        latest && (
          <p className="text-sm text-muted">
            No alerts in the last {rangeLabel}. The one above is older than this window.
          </p>
        )
      )}
    </div>
  );
}
