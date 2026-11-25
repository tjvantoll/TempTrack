/**
 * Device UIDs look like `dev:860000000000000`. The colons are escaped to `%3A`
 * even though they are legal in a path segment: the server always names the
 * route param in its escaped form, and with readable colons in the link Next's
 * prefetcher never matched its own response and refetched it in a tight loop —
 * each round a Notehub request, which drained the API rate limit for as long
 * as the fleet page stayed open.
 */
export function deviceHref(uid: string, page: "dashboard" | "settings" = "dashboard", query?: string) {
  const segment = encodeURIComponent(uid);
  const path = page === "settings" ? `/devices/${segment}/settings` : `/devices/${segment}`;
  return query ? `${path}?${query}` : path;
}

/** The `[uid]` route param, decoded whether or not the browser escaped it. */
export function decodeDeviceParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Display name for a device, most human-friendly first. */
export function deviceName(device: { serialNumber: string | null; bestId: string | null; uid: string }) {
  return device.serialNumber || device.bestId || device.uid;
}
