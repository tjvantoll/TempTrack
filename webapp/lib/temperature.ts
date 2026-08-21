/**
 * Temperature display, and the one-way street between what the UI shows and
 * what the device stores.
 *
 * The firmware is Celsius end to end: the env var names carry a `_c` suffix and
 * both thresholds are read through `atoi` (firmware/src/main.cpp:38-61), so the
 * only value Notehub can usefully hold is a whole number of degrees Celsius.
 * Fahrenheit exists here strictly as a display and input convenience, and
 * `toStoredCelsius` is deliberately the only path back.
 */

export const UNITS = ["f", "c"] as const;
export type Unit = (typeof UNITS)[number];

export const DEFAULT_UNIT: Unit = "f";

export function resolveUnit(raw: string | string[] | undefined): Unit {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const lowered = value?.trim().toLowerCase();
  return UNITS.includes(lowered as Unit) ? (lowered as Unit) : DEFAULT_UNIT;
}

export function unitLabel(unit: Unit): string {
  return unit === "f" ? "°F" : "°C";
}

export function cToF(celsius: number): number {
  return celsius * 9 / 5 + 32;
}

export function fToC(fahrenheit: number): number {
  return (fahrenheit - 32) * 5 / 9;
}

/** A Celsius reading converted for display in the chosen unit. */
export function fromCelsius(celsius: number, unit: Unit): number {
  return unit === "f" ? cToF(celsius) : celsius;
}

/**
 * A number the person typed, in the unit they are working in, converted to the
 * whole Celsius integer that will actually be written to Notehub. Rounding
 * happens here and only here, so the settings form can show the person the
 * stored value before they commit to it.
 */
export function toStoredCelsius(value: number, unit: Unit): number {
  return Math.round(unit === "f" ? fToC(value) : value);
}

/**
 * Format a Celsius reading for display. One decimal by default: `alert.qo`
 * carries `temp` as a float, and rounding a 30.4 °C alert to 30 °C against a
 * 30 °C threshold would make the alert look like it fired at the boundary.
 */
export function formatTemp(
  celsius: number,
  unit: Unit,
  { precision = 1, withUnit = true }: { precision?: number; withUnit?: boolean } = {},
): string {
  const value = fromCelsius(celsius, unit);
  const text = value.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  return withUnit ? `${text} ${unitLabel(unit)}` : text;
}

/**
 * Whole degrees, for the settings inputs. The stored value is a whole Celsius
 * integer, so showing 71.6 °F for a stored 22 °C invites someone to "fix" it
 * into a different Celsius value than the one already there.
 */
export function thresholdInputValue(celsius: number, unit: Unit): string {
  return String(Math.round(fromCelsius(celsius, unit)));
}
