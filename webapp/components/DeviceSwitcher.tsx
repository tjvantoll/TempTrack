"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { deviceHref, deviceName } from "@/lib/device-url";
import type { DeviceSummary } from "@/lib/notehub";

/** Jump to another device, staying on the same page (dashboard or settings). */
export function DeviceSwitcher({
  devices,
  selected,
}: {
  devices: DeviceSummary[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (devices.length < 2) return null;

  const page = pathname.endsWith("/settings") ? "settings" : "dashboard";

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span>Device</span>
      <select
        value={selected}
        disabled={isPending}
        onChange={(event) => {
          const href = deviceHref(event.target.value, page, searchParams.toString());
          startTransition(() => router.push(href, { scroll: false }));
        }}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
      >
        {devices.map((device) => (
          <option key={device.uid} value={device.uid}>
            {deviceName(device)}
          </option>
        ))}
      </select>
    </label>
  );
}
