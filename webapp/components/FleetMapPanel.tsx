"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/Skeleton";
import type { FleetMapProps } from "@/lib/fleet";

/** Leaflet touches `window` at import, so the map renders on the client only. */
const FleetMap = dynamic(() => import("@/components/FleetMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

export function FleetMapPanel(props: FleetMapProps) {
  const placed = props.devices.filter((d) => d.lat !== null && d.lon !== null).length;

  return (
    <div className="relative h-[360px] overflow-hidden rounded-xl border border-line sm:h-[440px]">
      <FleetMap {...props} />
      {placed === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <p className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-muted shadow">
            No device has reported a location yet.
          </p>
        </div>
      )}
    </div>
  );
}
