"use client";

import { UNITS, unitLabel } from "@/lib/temperature";
import { setUnit, useUnit } from "@/lib/unit-preference";

/**
 * Display units. Remembered in this browser (see lib/unit-preference.ts) and
 * applied instantly on the client — no navigation, no server round trip.
 *
 * This only changes what is rendered. Thresholds are always stored as whole
 * Celsius because that is all the firmware can read — see lib/temperature.ts.
 */
export function UnitToggle() {
  const value = useUnit();

  return (
    <div
      role="group"
      aria-label="Temperature units"
      className="inline-flex rounded-lg border border-line bg-surface-alt p-0.5"
    >
      {UNITS.map((unit) => {
        const active = unit === value;
        return (
          <button
            key={unit}
            type="button"
            aria-pressed={active}
            onClick={() => setUnit(unit)}
            className={[
              "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            {unitLabel(unit)}
            <span className="sr-only">
              {unit === "f" ? " — show Fahrenheit" : " — show Celsius"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
