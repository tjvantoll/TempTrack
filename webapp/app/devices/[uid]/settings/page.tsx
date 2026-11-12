import { Card } from "@/components/Card";
import { DeviceInfo } from "@/components/DeviceInfo";
import { DeviceSettings } from "@/components/DeviceSettings";
import type { StoredSettings } from "@/components/DeviceSettingsForm";
import { ErrorNotice } from "@/components/ErrorNotice";
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
import { decodeDeviceParam } from "@/lib/device-url";
import { NotehubApiError, findDevice, getEnvironmentVariables } from "@/lib/notehub";

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

export default async function SettingsPage({
  params,
}: PageProps<"/devices/[uid]/settings">) {
  const { uid } = await params;

  // Resolved (with errors and not-found handled) by the layout; request-cached.
  const resolved = await findDevice(decodeDeviceParam(uid)).catch(() => null);
  if (!resolved) return null;
  const { device } = resolved;

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

  const stored: StoredSettings = {
    name: variables[DEVICE_NAME_VAR] ?? device.serialNumber ?? "",
    minC: minEnabled ? minC : null,
    maxC: maxEnabled ? maxC : null,
    recheck: String(storedInt(variables, ALERT_RECHECK_VAR, ALERT_RECHECK_DEFAULT)),
  };

  return (
    <div className="space-y-8">

      <Card title="Device settings">
        {/* Keyed on the device so switching devices re-seeds the form from
            scratch, rather than carrying one device's unsaved edits to the next. */}
        <DeviceSettings key={device.uid} deviceUid={device.uid} stored={stored} />
      </Card>

      <Card title="Device information">
        <DeviceInfo device={device} />
      </Card>
    </div>
  );
}
