"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { UNITS, unitLabel, type Unit } from "@/lib/temperature";

/**
 * Display units, in the URL alongside the range so a shared link shows the same
 * numbers the sender was reading.
 *
 * This only changes what is rendered. Thresholds are always stored as whole
 * Celsius because that is all the firmware can read — see lib/temperature.ts.
 */
export function UnitToggle({ value }: { value: Unit }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const select = (unit: Unit) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("unit", unit);
    startTransition(() => router.push(`?${params.toString()}`, { scroll: false }));
  };

  return (
    <div
      role="group"
      aria-label="Temperature units"
      data-pending={isPending ? "" : undefined}
      className="inline-flex rounded-lg border border-line bg-surface-alt p-0.5 data-pending:opacity-60"
    >
      {UNITS.map((unit) => {
        const active = unit === value;
        return (
          <button
            key={unit}
            type="button"
            aria-pressed={active}
            onClick={() => select(unit)}
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
