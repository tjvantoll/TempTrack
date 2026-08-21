"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { DeviceSummary } from "@/lib/notehub";

export function DeviceSwitcher({
  devices,
  selected,
}: {
  devices: DeviceSummary[];
  selected: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (devices.length < 2) return null;

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span>Device</span>
      <select
        value={selected}
        disabled={isPending}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("device", event.target.value);
          startTransition(() => router.push(`?${params.toString()}`, { scroll: false }));
        }}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
      >
        {devices.map((device) => (
          <option key={device.uid} value={device.uid}>
            {device.serialNumber || device.bestId || device.uid}
          </option>
        ))}
      </select>
    </label>
  );
}
