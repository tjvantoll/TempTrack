import Link from "next/link";
import { notFound } from "next/navigation";
import { DeviceSwitcher } from "@/components/DeviceSwitcher";
import { DeviceTabs } from "@/components/DeviceTabs";
import { ErrorNotice, SetupNotice } from "@/components/ErrorNotice";
import { UnitToggle } from "@/components/UnitToggle";
import { decodeDeviceParam, deviceName } from "@/lib/device-url";
import { NotehubApiError, NotehubConfigError, findDevice } from "@/lib/notehub";

export const dynamic = "force-dynamic";

/**
 * Chrome shared by a device's dashboard and settings: the way back to the
 * fleet, the device's name, the tabs between its two pages, and a switcher.
 * `listDevices` is request-cached, so the page below reuses this lookup.
 */
export default async function DeviceLayout({ children, params }: LayoutProps<"/devices/[uid]">) {
  const uid = decodeDeviceParam((await params).uid);

  let resolved: Awaited<ReturnType<typeof findDevice>>;
  try {
    resolved = await findDevice(uid);
  } catch (error) {
    if (error instanceof NotehubConfigError) return <SetupNotice message={error.message} />;
    if (error instanceof NotehubApiError) {
      return <ErrorNotice title="Could not reach Notehub" message={error.message} />;
    }
    throw error;
  }
  if (!resolved) notFound();

  const { device, all } = resolved;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/" className="text-sm text-primary hover:text-[var(--primary-hover)]">
          ← Fleet
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-ink">{deviceName(device)}</h1>
            {device.location && <p className="text-sm text-muted">{device.location}</p>}
          </div>
          <DeviceSwitcher devices={all} selected={device.uid} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <DeviceTabs uid={device.uid} />
          <UnitToggle />
        </div>
      </div>
      {children}
    </div>
  );
}
