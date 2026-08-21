"use client";

import { useMemo, useState } from "react";
import {
  ALERT_RECHECK_VAR,
  DEVICE_NAME_MAX_LENGTH,
  DEVICE_NAME_VAR,
  TEMP_MAX_DISABLED,
  TEMP_MAX_VAR,
  TEMP_MIN_DISABLED,
  TEMP_MIN_VAR,
  validateDeviceName,
  validateRecheckInterval,
  validateTempThreshold,
  validateThresholdPair,
} from "@/lib/env-vars";
import { toStoredCelsius, unitLabel, type Unit } from "@/lib/temperature";

type Vars = Record<string, string>;

/** Starting points for a threshold being switched on for the first time. */
const SUGGESTED_MIN_C = 0;
const SUGGESTED_MAX_C = 30;

export type InitialSettings = {
  name: string;
  /** Threshold in the display unit, or "" while that direction is off. */
  minValue: string;
  maxValue: string;
  minEnabled: boolean;
  maxEnabled: boolean;
  recheck: string;
};

const errorStyle = { color: "var(--alert-ink)" };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-sm" style={errorStyle}>
      {message}
    </p>
  );
}

/**
 * Everything a person can change about a TempTrack. The Notehub variable names,
 * the integer-only storage and the sentinel values that mean "off" all stay out
 * of the interface.
 *
 * Saving is pessimistic rather than optimistic: nothing on screen moves until
 * Notehub has confirmed the write, and the inputs are then re-seeded from what
 * Notehub actually stored. A settings page that reports success before the
 * write lands is the one place optimism is genuinely harmful.
 */
export function DeviceSettingsForm({
  deviceUid,
  unit,
  initial,
}: {
  deviceUid: string;
  unit: Unit;
  initial: InitialSettings;
}) {
  const [name, setName] = useState(initial.name);
  const [minEnabled, setMinEnabled] = useState(initial.minEnabled);
  const [maxEnabled, setMaxEnabled] = useState(initial.maxEnabled);
  const [minValue, setMinValue] = useState(initial.minValue);
  const [maxValue, setMaxValue] = useState(initial.maxValue);
  const [recheck, setRecheck] = useState(initial.recheck);

  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== saved.name ||
    minEnabled !== saved.minEnabled ||
    maxEnabled !== saved.maxEnabled ||
    (minEnabled && minValue !== saved.minValue) ||
    (maxEnabled && maxValue !== saved.maxValue) ||
    recheck !== saved.recheck;

  /**
   * What will actually be stored. Shown beside the inputs whenever the person
   * is working in Fahrenheit, because the device only understands whole
   * Celsius and 74 °F is not a whole number of degrees Celsius — better to say
   * so before the save than to have the field change under them after it.
   */
  const storedHint = useMemo(() => {
    if (unit !== "f") return null;
    const hint = (raw: string) => {
      const value = Number(raw.trim());
      if (!raw.trim() || !Number.isFinite(value)) return null;
      return `Stored as ${toStoredCelsius(value, unit)} °C`;
    };
    return { min: hint(minValue), max: hint(maxValue) };
  }, [unit, minValue, maxValue]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setFormError(null);

    const nameResult = validateDeviceName(name);

    /**
     * A threshold is typed in the display unit but validated as the Celsius
     * integer that will actually be stored, so the range check applies to the
     * value the device will really see. A bound that is switched off resolves
     * straight to the sentinel and is never validated as a temperature — there
     * is nothing the person typed to check, and the sentinel is deliberately
     * outside the sensor's range.
     */
    const resolveThreshold = (
      raw: string,
      enabled: boolean,
      sentinel: number,
    ) => {
      if (!enabled) return { ok: true as const, value: String(sentinel) };
      const trimmed = raw.trim();
      if (!trimmed) {
        return {
          ok: false as const,
          error: "Enter a temperature, or turn this alert off.",
        };
      }
      if (!/^-?\d+$/.test(trimmed)) {
        return {
          ok: false as const,
          error:
            "Enter a whole number of degrees — the device rounds anything finer.",
        };
      }
      return validateTempThreshold(
        String(toStoredCelsius(Number(trimmed), unit)),
      );
    };

    const minResult = resolveThreshold(minValue, minEnabled, TEMP_MIN_DISABLED);
    const maxResult = resolveThreshold(maxValue, maxEnabled, TEMP_MAX_DISABLED);

    const recheckResult = validateRecheckInterval(recheck);

    const nextErrors: Record<string, string | undefined> = {
      name: nameResult.ok ? undefined : nameResult.error,
      min: minResult.ok ? undefined : minResult.error,
      max: maxResult.ok ? undefined : maxResult.error,
      recheck: recheckResult.ok ? undefined : recheckResult.error,
    };

    // The band check needs both resolved values, so it runs only once each side
    // has passed on its own — and only when both are on, since a sentinel bound
    // cannot invert the band.
    if (minEnabled && maxEnabled && minResult.ok && maxResult.ok) {
      const conflict = validateThresholdPair(
        Number(minResult.value),
        Number(maxResult.value),
      );
      if (conflict) nextErrors.min = conflict;
    }

    setErrors(nextErrors);
    // Each result is checked by name as well as through nextErrors, so the
    // compiler narrows them to their ok variants for the rest of this function.
    if (
      !nameResult.ok ||
      !minResult.ok ||
      !maxResult.ok ||
      !recheckResult.ok ||
      Object.values(nextErrors).some(Boolean)
    ) {
      return;
    }

    // Send only what changed, so renaming the device does not also write a
    // threshold the person never touched.
    const changed: Vars = {};
    if (nameResult.value !== saved.name)
      changed[DEVICE_NAME_VAR] = nameResult.value;

    const nextMin = minResult.value;
    const nextMax = maxResult.value;
    const savedMin = saved.minEnabled
      ? String(toStoredCelsius(Number(saved.minValue), unit))
      : String(TEMP_MIN_DISABLED);
    const savedMax = saved.maxEnabled
      ? String(toStoredCelsius(Number(saved.maxValue), unit))
      : String(TEMP_MAX_DISABLED);

    if (nextMin !== savedMin) changed[TEMP_MIN_VAR] = nextMin;
    if (nextMax !== savedMax) changed[TEMP_MAX_VAR] = nextMax;
    if (recheckResult.value !== saved.recheck)
      changed[ALERT_RECHECK_VAR] = recheckResult.value;

    if (!Object.keys(changed).length) {
      setNotice("Nothing to save.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/env", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: deviceUid, variables: changed }),
      });
      const payload = (await response.json()) as {
        variables?: Vars;
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error ?? `Could not save (${response.status})`);

      // Re-seed from what Notehub actually holds, so a value the device will
      // see differently from what was typed shows its real form immediately.
      const stored = payload.variables ?? {};
      const next: InitialSettings = {
        name: stored[DEVICE_NAME_VAR] ?? nameResult.value,
        minEnabled:
          (stored[TEMP_MIN_VAR] ?? nextMin) !== String(TEMP_MIN_DISABLED),
        maxEnabled:
          (stored[TEMP_MAX_VAR] ?? nextMax) !== String(TEMP_MAX_DISABLED),
        minValue: minEnabled ? minValue : "",
        maxValue: maxEnabled ? maxValue : "",
        recheck: stored[ALERT_RECHECK_VAR] ?? recheckResult.value,
      };

      setName(next.name);
      setMinEnabled(next.minEnabled);
      setMaxEnabled(next.maxEnabled);
      setMinValue(next.minValue);
      setMaxValue(next.maxValue);
      setRecheck(next.recheck);
      setSaved(next);
      setNotice("Settings saved.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const numberInput =
    "tnum w-24 rounded-lg border border-line bg-surface px-3 py-2 text-ink disabled:opacity-40";

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* --------------------------------------------------------- device */}
      <div>
        <label
          htmlFor="device-name"
          className="block text-sm font-medium text-ink"
        >
          Device name
        </label>
        <p className="mt-1 text-sm text-muted">
          The name used to identify this device.
        </p>
        <input
          id="device-name"
          value={name}
          maxLength={DEVICE_NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "device-name-error" : undefined}
          className="mt-2 w-full max-w-sm rounded-lg border border-line bg-surface px-3 py-2 text-ink"
        />
        <FieldError id="device-name-error" message={errors.name} />
      </div>

      {/* --------------------------------------------- temperature alerts */}
      <fieldset className="border-t border-line pt-6">
        <legend className="text-sm font-semibold text-ink">
          Temperature alerts
        </legend>
        <p className="mt-1 text-sm text-muted">
          The device reports when temperature leaves this range. Turn off a side
          to stop alerting in that direction.
        </p>

        <div className="mt-4 space-y-5">
          <div>
            <label className="flex items-center gap-2.5 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={minEnabled}
                onChange={(event) => {
                  const on = event.target.checked;
                  setMinEnabled(on);
                  // Coming back on with an empty field would fail validation
                  // for a reason the person did not cause.
                  if (on && !minValue.trim()) {
                    setMinValue(
                      String(Math.round(unit === "f" ? 32 : SUGGESTED_MIN_C)),
                    );
                  }
                }}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Alert me when it gets too cold
            </label>
            <div className="mt-2 flex items-center gap-2 pl-7">
              <span className="text-sm text-muted">below</span>
              <input
                id="temp-min"
                type="number"
                step={1}
                inputMode="numeric"
                value={minValue}
                disabled={!minEnabled}
                onChange={(event) => setMinValue(event.target.value)}
                aria-label={`Low temperature threshold in ${unitLabel(unit)}`}
                aria-invalid={errors.min ? true : undefined}
                aria-describedby={errors.min ? "temp-min-error" : undefined}
                className={numberInput}
              />
              <span className="text-sm text-muted">{unitLabel(unit)}</span>
              {minEnabled && storedHint?.min && (
                <span className="text-xs text-muted">{storedHint.min}</span>
              )}
            </div>
            <div className="pl-7">
              <FieldError id="temp-min-error" message={errors.min} />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2.5 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={maxEnabled}
                onChange={(event) => {
                  const on = event.target.checked;
                  setMaxEnabled(on);
                  if (on && !maxValue.trim()) {
                    setMaxValue(
                      String(Math.round(unit === "f" ? 86 : SUGGESTED_MAX_C)),
                    );
                  }
                }}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Alert me when it gets too hot
            </label>
            <div className="mt-2 flex items-center gap-2 pl-7">
              <span className="text-sm text-muted">above</span>
              <input
                id="temp-max"
                type="number"
                step={1}
                inputMode="numeric"
                value={maxValue}
                disabled={!maxEnabled}
                onChange={(event) => setMaxValue(event.target.value)}
                aria-label={`High temperature threshold in ${unitLabel(unit)}`}
                aria-invalid={errors.max ? true : undefined}
                aria-describedby={errors.max ? "temp-max-error" : undefined}
                className={numberInput}
              />
              <span className="text-sm text-muted">{unitLabel(unit)}</span>
              {maxEnabled && storedHint?.max && (
                <span className="text-xs text-muted">{storedHint.max}</span>
              )}
            </div>
            <div className="pl-7">
              <FieldError id="temp-max-error" message={errors.max} />
            </div>
          </div>

          <div>
            <label
              htmlFor="recheck"
              className="block text-sm font-medium text-ink"
            >
              Wait after an alert
            </label>
            <p className="mt-1 text-sm text-muted">
              After sending an alert the device sleeps this long before checking
              again, so one long hot/cold spell does not become a stream of
              alerts.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="recheck"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={recheck}
                onChange={(event) => setRecheck(event.target.value)}
                aria-invalid={errors.recheck ? true : undefined}
                aria-describedby={errors.recheck ? "recheck-error" : undefined}
                className={numberInput}
              />
              <span className="text-sm text-muted">minutes</span>
            </div>
            <FieldError id="recheck-error" message={errors.recheck} />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <button
          type="submit"
          disabled={saving || !dirty}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-[var(--primary-contrast)] transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        {formError ? (
          <p role="alert" className="text-sm" style={errorStyle}>
            {formError}
          </p>
        ) : (
          notice && (
            <p
              role="status"
              className="text-sm"
              style={{ color: "var(--ok-ink)" }}
            >
              {notice}
            </p>
          )
        )}
      </div>
    </form>
  );
}
