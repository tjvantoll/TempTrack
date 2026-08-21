/**
 * Device settings, shared by the form and the API route so the browser and the
 * server can never disagree about what is valid.
 *
 * Every one of these is read by the firmware through a single `atoi`-based
 * helper (firmware/src/main.cpp:38-61), which has two consequences the
 * validators below exist to respect:
 *
 *   - Only whole integers survive. `22.5` is stored as typed but reaches the
 *     device as `22`.
 *   - A value that does not parse as a number becomes `0`, not the firmware
 *     default. Only a *missing* variable falls back. So letting a stray
 *     non-numeric value through would silently reconfigure the device to zero
 *     rather than leaving it alone.
 */

/** Notehub uses this reserved variable as the device's serial number / name. */
export const DEVICE_NAME_VAR = "_sn";

export const TEMP_MIN_VAR = "alert_temp_min_c";
export const TEMP_MAX_VAR = "alert_temp_max_c";
export const ALERT_RECHECK_VAR = "alert_recheck_interval_min";

/**
 * Firmware defaults (firmware/src/main.cpp:17-21). An unset variable means the
 * device is running these, so they are what the form shows — displaying an
 * empty field would imply the device has no threshold at all.
 */
export const TEMP_MIN_DEFAULT = -999;
export const TEMP_MAX_DEFAULT = 999;
export const ALERT_RECHECK_DEFAULT = 10;

/**
 * The firmware's "never alert" sentinels, which are just the defaults being
 * unreachable temperatures rather than a real flag. The UI turns them into a
 * checkbox; they should never appear in the interface as numbers.
 */
export const TEMP_MIN_DISABLED = TEMP_MIN_DEFAULT;
export const TEMP_MAX_DISABLED = TEMP_MAX_DEFAULT;

/**
 * The BME280's operating range (datasheet: -40 to +85 °C). A threshold outside
 * it can never be crossed by a working sensor, so it would be an alert that
 * never fires — indistinguishable from the sentinel, but without saying so.
 */
export const TEMP_LIMIT_MIN_C = -40;
export const TEMP_LIMIT_MAX_C = 85;

export const DEVICE_NAME_MAX_LENGTH = 60;

/**
 * `alert_recheck_interval_min` is multiplied by 60 into an int for a
 * `card.attn` sleep (firmware/src/main.cpp:168), so the product must stay
 * inside a signed 32-bit integer. This leaves generous headroom.
 */
export const ALERT_RECHECK_MAX = 35000;

/**
 * The only settings this app will write. Anything else is rejected.
 *
 * The firmware also reads `card_motion_seconds` and `card_motion_motion`
 * (firmware/src/main.cpp:78-79), and they are deliberately absent: this app
 * does not surface them, so it must not be able to write them either. Whatever
 * Notehub already holds for those is left alone.
 */
export const EDITABLE_VARS: string[] = [
  DEVICE_NAME_VAR,
  TEMP_MIN_VAR,
  TEMP_MAX_VAR,
  ALERT_RECHECK_VAR,
];

export type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

export function validateDeviceName(raw: string): ValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Enter a name for this device." };
  if (trimmed.length > DEVICE_NAME_MAX_LENGTH) {
    return { ok: false, error: `Keep the name to ${DEVICE_NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return { ok: false, error: "Names cannot contain line breaks or control characters." };
  }
  return { ok: true, value: trimmed };
}

/** Shared shape for the three integer settings. */
function validateInteger(
  raw: string,
  {
    min,
    max,
    missing,
    tooSmall,
    tooLarge,
    allowNegative = false,
  }: {
    min: number;
    max: number;
    missing: string;
    tooSmall: string;
    tooLarge: string;
    allowNegative?: boolean;
  },
): ValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: missing };

  const pattern = allowNegative ? /^-?\d+$/ : /^\d+$/;
  if (!pattern.test(trimmed)) {
    return {
      ok: false,
      error: allowNegative
        ? "Enter a whole number of degrees — the device rounds anything finer."
        : "Enter a whole number.",
    };
  }

  const value = Number(trimmed);
  if (value < min) return { ok: false, error: tooSmall };
  if (value > max) return { ok: false, error: tooLarge };
  return { ok: true, value: String(value) };
}

export function validateTempThreshold(raw: string): ValidationResult {
  const trimmed = raw.trim();
  // The sentinels sit far outside the sensor's range and are how "off" is
  // stored, so they have to pass even though nothing else out there does.
  if (trimmed === String(TEMP_MIN_DISABLED) || trimmed === String(TEMP_MAX_DISABLED)) {
    return { ok: true, value: trimmed };
  }
  return validateInteger(raw, {
    min: TEMP_LIMIT_MIN_C,
    max: TEMP_LIMIT_MAX_C,
    allowNegative: true,
    missing: "Enter a temperature, or turn this alert off.",
    tooSmall: `The sensor cannot read below ${TEMP_LIMIT_MIN_C} °C.`,
    tooLarge: `The sensor cannot read above ${TEMP_LIMIT_MAX_C} °C.`,
  });
}

export function validateRecheckInterval(raw: string): ValidationResult {
  return validateInteger(raw, {
    min: 1,
    max: ALERT_RECHECK_MAX,
    missing: "Enter how long to wait before checking again.",
    // Zero becomes a card.attn sleep of zero seconds, which is a hot loop.
    tooSmall: "Enter at least 1 minute.",
    tooLarge: `Enter ${ALERT_RECHECK_MAX.toLocaleString()} minutes or fewer.`,
  });
}

export function validateSetting(name: string, value: string): ValidationResult {
  switch (name) {
    case DEVICE_NAME_VAR:
      return validateDeviceName(value);
    case TEMP_MIN_VAR:
    case TEMP_MAX_VAR:
      return validateTempThreshold(value);
    case ALERT_RECHECK_VAR:
      return validateRecheckInterval(value);
    default:
      return { ok: false, error: "This setting cannot be changed here." };
  }
}

/**
 * Cross-field check the per-field validators cannot make. A min at or above the
 * max leaves the firmware's band inverted, so `temperature > temp_max ||
 * temperature < temp_min` (firmware/src/main.cpp:137) is true at every
 * temperature and the device alerts on every reading it takes.
 */
export function validateThresholdPair(
  minC: number | null,
  maxC: number | null,
): string | null {
  if (minC === null || maxC === null) return null;
  if (minC >= maxC) {
    return "The low threshold has to be below the high one, or the device alerts on every reading.";
  }
  return null;
}
