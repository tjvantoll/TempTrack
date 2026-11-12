import { redirect } from "next/navigation";
import { deviceHref } from "@/lib/device-url";

/** Settings moved under each device. Old `/settings?device=…` links land there. */
export default async function LegacySettingsPage({ searchParams }: PageProps<"/settings">) {
  const query = await searchParams;
  const device = Array.isArray(query.device) ? query.device[0] : query.device;
  redirect(device ? deviceHref(device, "settings") : "/");
}
