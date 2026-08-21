import type { TrackPoint } from "./notehub";

/** [south, west] and [north, east], the shape Leaflet's fitBounds wants. */
export type Bounds = [[number, number], [number, number]];

export type LatLng = [number, number];

export function trail(points: TrackPoint[]): LatLng[] {
  return points.map((point) => [point.lat, point.lon]);
}

/**
 * Bounding box of the whole track, padded so markers at the extremes are not
 * clipped by the viewport edge.
 *
 * Returns null for an empty track. A single event also gets a box rather than a
 * degenerate point, because `fitBounds` on a zero-area bounds zooms to the
 * maximum level available — which puts a stationary tracker at street level
 * with no context around it.
 */
export function trackBounds(points: TrackPoint[], padDegrees = 0.0025): Bounds | null {
  if (!points.length) return null;

  let south = points[0].lat;
  let north = points[0].lat;
  let west = points[0].lon;
  let east = points[0].lon;

  for (const point of points) {
    if (point.lat < south) south = point.lat;
    if (point.lat > north) north = point.lat;
    if (point.lon < west) west = point.lon;
    if (point.lon > east) east = point.lon;
  }

  const pad = Math.max(padDegrees, (north - south) * 0.08, (east - west) * 0.08);
  return [
    [south - pad, west - pad],
    [north + pad, east + pad],
  ];
}

/** Metres between two events, on a sphere. Good enough at tracker distances. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Total path length over the shown range, summed from the coordinates
 * themselves rather than from `_track.qo`'s own `distance` field — that field is
 * missing on heartbeat notes, so summing it undercounts.
 */
export function pathLengthMeters(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distanceMeters(
      [points[i - 1].lat, points[i - 1].lon],
      [points[i].lat, points[i].lon],
    );
  }
  return total;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters).toLocaleString()} m`;
  return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

export function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
