import { formatNumber, humanizeKey, sessionFieldDef } from "@/lib/fields";
import type { SessionSample } from "@/lib/notehub";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * Every field on the most recent session, merged from its open and close
 * events. Unrecognised keys render generically rather than being dropped, so a
 * Notecard firmware update that adds telemetry shows up here without a code
 * change.
 */
export function SessionTable({ sample }: { sample: SessionSample | null }) {
  if (!sample) {
    return <p className="py-6 text-center text-sm text-muted">No session events in this window.</p>;
  }

  const entries = Object.entries(sample.fields).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) {
    return <p className="py-6 text-center text-sm text-muted">The latest session carried no fields.</p>;
  }

  const format = (key: string, value: string | number | boolean) => {
    const def = sessionFieldDef(key);
    if (typeof value === "boolean") return value ? "yes" : "no";
    if (def.kind === "timestamp" && typeof value === "number" && value > 0) {
      // Notecard reports these in seconds.
      return new Date(value * 1000).toLocaleString();
    }
    if (typeof value === "number") {
      const formatted = formatNumber(value, def.precision ?? (Number.isInteger(value) ? 0 : 2));
      return def.unit ? `${formatted} ${def.unit}` : formatted;
    }
    return value;
  };

  return (
    <div className="overflow-x-auto">
      <p className="mb-3 text-sm text-muted">
        Connected{" "}
        <time dateTime={new Date(sample.t).toISOString()}>
          {new Date(sample.t).toLocaleString()}
        </time>
        {sample.durationSec !== null && <> · lasted {formatDuration(sample.durationSec)}</>}
      </p>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Fields on the most recent session event</caption>
        <tbody>
          {entries.map(([key, value]) => {
            const def = sessionFieldDef(key);
            const known = def.label !== humanizeKey(key);
            return (
              <tr key={key} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 pr-4 font-normal align-top">
                  <span className="text-ink">{def.label}</span>
                  {known && <span className="ml-2 font-mono text-xs text-muted">{key}</span>}
                </th>
                <td className="tnum py-2 text-right font-medium text-ink">{format(key, value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
