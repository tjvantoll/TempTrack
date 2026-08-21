import { formatNumber, trackFieldDef, TRACK_DETAIL_KEYS } from "@/lib/fields";
import { formatCoords } from "@/lib/track";
import { formatTemp, type Unit } from "@/lib/temperature";
import type { TrackPoint } from "@/lib/notehub";

/**
 * What a single tracking event carried. This is the accessible reading of the
 * map: the marker shows where, and these rows say where in numbers, plus why
 * the Notecard bothered to record it.
 */
export function LocationDetails({
  point,
  unit,
  compact = false,
}: {
  point: TrackPoint | null;
  unit: Unit;
  /**
   * Drop the per-field explanations. They are worth the room in a full-width
   * panel; inside a 300px map popup they wrap to four lines each and bury the
   * numbers they were meant to support.
   */
  compact?: boolean;
}) {
  if (!point) {
    return <p className="py-6 text-sm text-muted">No tracking event selected.</p>;
  }

  /**
   * `time` is the event's own capture time, which the popup header already
   * shows — and as a bare number it renders as a nine-digit integer that reads
   * like a measurement. Coordinates are on the point itself. Neither belongs in
   * the generic field list.
   */
  const seen = new Set<string>(["lat", "lon", "time"]);
  const rows: { key: string; label: string; value: string; hint?: string }[] = [
    {
      key: "coords",
      label: "Coordinates",
      value: formatCoords(point.lat, point.lon),
    },
  ];

  const render = (key: string) => {
    const raw = point.fields[key];
    if (raw === undefined) return;
    seen.add(key);

    const def = trackFieldDef(key);
    let value: string;

    if (typeof raw === "boolean") {
      value = raw ? "Yes" : "No";
    } else if (typeof raw === "number") {
      // The Notecard reports its own temperature in Celsius; show it in
      // whichever unit the person is reading the rest of the page in.
      value = def.plain
        ? String(raw)
        : key === "temperature"
          ? formatTemp(raw, unit)
          : `${formatNumber(raw, def.precision ?? 0)}${def.unit ? ` ${def.unit}` : ""}`;
    } else {
      value = raw;
    }

    rows.push({ key, label: def.label, value, hint: compact ? undefined : def.description });
  };

  for (const key of TRACK_DETAIL_KEYS) render(key);
  // Anything the Notecard sent that this app does not know about still shows,
  // so a firmware update that adds a field is visible rather than swallowed.
  for (const key of Object.keys(point.fields).sort()) {
    if (!seen.has(key)) render(key);
  }

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Details of the selected tracking event</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-line last:border-0">
            <th scope="row" className="py-2 pr-4 text-left font-normal align-top text-muted">
              {row.label}
              {row.hint && (
                <span className="mt-0.5 block text-xs text-muted opacity-75">{row.hint}</span>
              )}
            </th>
            <td className="tnum whitespace-nowrap py-2 text-right align-top font-medium text-ink">
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
