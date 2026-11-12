"use client";

import { StatTile } from "@/components/StatTile";
import { formatTemp, fromCelsius, unitLabel } from "@/lib/temperature";
import { useUnit } from "@/lib/unit-preference";

/**
 * A Celsius reading shown in the viewer's chosen unit. Server components render
 * this rather than formatting temperatures themselves, because the unit lives
 * in the browser.
 */
export function Temperature({
  celsius,
  precision,
  withUnit,
}: {
  celsius: number;
  precision?: number;
  withUnit?: boolean;
}) {
  const unit = useUnit();
  return <>{formatTemp(celsius, unit, { precision, withUnit })}</>;
}

/** A StatTile for a Celsius reading, converted to the viewer's unit. */
export function TemperatureTile({
  label,
  celsius,
  note,
}: {
  label: string;
  celsius: number | null;
  note?: string;
}) {
  const unit = useUnit();
  return (
    <StatTile
      label={label}
      value={celsius === null ? null : fromCelsius(celsius, unit)}
      unit={unitLabel(unit)}
      precision={1}
      note={note}
    />
  );
}
