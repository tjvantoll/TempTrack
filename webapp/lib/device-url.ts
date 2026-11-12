/**
 * Device UIDs look like `dev:860000000000000`. Colons are legal in a path
 * segment, so they are left readable rather than escaped to `%3A`; anything
 * else unusual is still encoded.
 */
export function deviceHref(uid: string, page: "dashboard" | "settings" = "dashboard", query?: string) {
  const segment = encodeURIComponent(uid).replace(/%3A/gi, ":");
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
