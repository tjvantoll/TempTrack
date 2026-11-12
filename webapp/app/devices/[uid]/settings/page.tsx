import { Card } from "@/components/Card";
import { DeviceInfo } from "@/components/DeviceInfo";
import { DeviceSettingsForm, type InitialSettings } from "@/components/DeviceSettingsForm";
import { DeviceSwitcher } from "@/components/DeviceSwitcher";
import { ErrorNotice, SetupNotice } from "@/components/ErrorNotice";
import { UnitToggle } from "@/components/UnitToggle";
import {
  ALERT_RECHECK_DEFAULT,
  ALERT_RECHECK_VAR,
  DEVICE_NAME_VAR,
  TEMP_MAX_DEFAULT,
  TEMP_MAX_DISABLED,
  TEMP_MAX_VAR,
  TEMP_MIN_DEFAULT,
  TEMP_MIN_DISABLED,
  TEMP_MIN_VAR,
} from "@/lib/env-vars";
import {
  NotehubApiError,
  NotehubConfigError,
  getEnvironmentVariables,
  resolveDevice,
} from "@/lib/notehub";
import { resolveUnit, thresholdInputValue } from "@/lib/temperature";

export const dynamic = "force-dynamic";

/**
 * An integer setting as stored, or the firmware's own default where Notehub has
 * never held a value. An unset variable means the device is running the value
 * compiled into it (firmware/src/main.cpp:17-21), so that is the honest thing
 * to show — an empty field would imply the setting does not exist.
 */
function storedInt(variables: Record<string, string>, name: string, fallback: number): number {
  const raw = variables[name];
  if (raw === undefined) return fallback;
  const value = Number(raw.trim());
  return Number.isFinite(value) ? value : fallback;
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const params = await searchParams;
  const unit = resolveUnit(params.unit);
  const requestedDevice = Array.isArray(params.device) ? params.device[0] : params.device;

  let resolved: Awaited<ReturnType<typeof resolveDevice>> = null;
  let failure: Error | null = null;
  try {
    resolved = await resolveDevice(requestedDevice);
  } catch (error) {
    if (error instanceof NotehubConfigError || error instanceof NotehubApiError) {
      failure = error;
    } else {
      throw error;
    }
  }

  if (failure instanceof NotehubConfigError) return <SetupNotice message={failure.message} />;
  if (failure) return <ErrorNotice title="Could not reach Notehub" message={failure.message} />;

  if (!resolved) {
    return (
      <ErrorNotice
        title="No devices in this project"
        message="Notehub returned no devices for this project UID."
        hint="Check that NOTEHUB_PROJECT_UID points at the project your TempTrack device reports into."
      />
    );
  }

  const { device, all } = resolved;

  let variables: Record<string, string>;
  try {
    variables = await getEnvironmentVariables(device.uid);
  } catch (error) {
    if (error instanceof NotehubApiError) {
      return <ErrorNotice title="Could not load settings" message={error.message} />;
    }
    throw error;
  }

  const minC = storedInt(variables, TEMP_MIN_VAR, TEMP_MIN_DEFAULT);
  const maxC = storedInt(variables, TEMP_MAX_VAR, TEMP_MAX_DEFAULT);
  const minEnabled = minC !== TEMP_MIN_DISABLED;
  const maxEnabled = maxC !== TEMP_MAX_DISABLED;

  const initial: InitialSettings = {
    name: variables[DEVICE_NAME_VAR] ?? device.serialNumber ?? "",
    minEnabled,
    maxEnabled,
    // A disabled bound has no temperature to show. Leaving it blank rather than
    // rendering the sentinel keeps -999 out of the interface entirely.
    minValue: minEnabled ? thresholdInputValue(minC, unit) : "",
    maxValue: maxEnabled ? thresholdInputValue(maxC, unit) : "",
    recheck: String(storedInt(variables, ALERT_RECHECK_VAR, ALERT_RECHECK_DEFAULT)),
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Settings</h1>
          <p className="text-sm text-muted">
            {device.serialNumber || device.bestId || device.uid}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <UnitToggle value={unit} />
          <DeviceSwitcher devices={all} selected={device.uid} />
        </div>
      </div>

      <Card title="Device settings">
        {/* The form is keyed on the device and the unit so switching either
            re-seeds it from scratch. Without this, editing one device and then
            switching would carry the first device's unsaved values across. */}
        <DeviceSettingsForm
          key={`${device.uid}:${unit}`}
          deviceUid={device.uid}
          unit={unit}
          initial={initial}
        />
      </Card>

      <Card title="Device information">
        <DeviceInfo device={device} />
      </Card>
    </div>
  );
}
