import type { DeviceSummary } from "@/lib/notehub";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <tr className="border-b border-line last:border-0">
      <th scope="row" className="w-2/5 py-2 pr-4 text-left align-top font-normal text-muted">
        {label}
      </th>
      <td className="break-words py-2 text-right align-top font-medium text-ink">
        {value ?? "—"}
      </td>
    </tr>
  );
}

/**
 * Read-only hardware facts. The device's name is editable in the settings form
 * above, so it is deliberately not repeated here.
 */
export function DeviceInfo({ device }: { device: DeviceSummary }) {
  const when = (iso: string | null) => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  };

  return (
    <table className="w-full table-fixed text-sm">
      <caption className="sr-only">Device information</caption>
      <tbody>
        <Row label="Device ID" value={device.uid} />
        <Row label="Model" value={device.sku} />
        <Row label="Notecard firmware" value={device.firmwareNotecard} />
        <Row label="Host firmware" value={device.firmwareHost} />
        <Row label="Last activity" value={when(device.lastActivity)} />
        <Row label="Activated" value={when(device.provisioned)} />
        <Row
          label="Voltage"
          value={device.voltage === null ? null : `${device.voltage.toFixed(2)} V`}
        />
        <Row label="Last known location" value={device.location} />
        <Row label="Status" value={device.disabled ? "Disabled" : "Active"} />
      </tbody>
    </table>
  );
}
