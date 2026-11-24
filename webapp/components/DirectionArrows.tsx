"use client";

import { useMemo, useState } from "react";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

/** Shortest segment, in screen pixels, that has room for an arrow. */
const MIN_SEGMENT_PX = 40;
/** Minimum gap between consecutive arrows, so clusters do not fill with them. */
const MIN_ARROW_GAP_PX = 60;
/** Ceiling on arrows drawn, as a backstop on a long track at high zoom. */
const MAX_ARROWS = 60;

function arrowIcon(angle: number) {
  return L.divIcon({
    className: "",
    // Rotated on the wrapper so the SVG itself stays a plain right-pointing
    // arrow and the angle is the only thing that varies per instance.
    html:
      `<div class="track-arrow" style="transform: rotate(${angle}deg)">` +
      '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5 L9.5 6 L2.5 10.5 Z" /></svg>' +
      "</div>",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/**
 * Direction arrows along a path, oldest point first. Used by the device
 * dashboard's track and by each journey on the fleet map, so a trip reads the
 * same way on both.
 *
 * Placement is decided in screen space rather than in degrees, because that is
 * the only space where "is there room for an arrow here" has an answer: a
 * segment that is 200 m long deserves an arrow when zoomed into a street and
 * not when the whole month is on screen. So this recomputes on zoom, keeps
 * arrows off segments too short to hold one, and enforces a gap between
 * consecutive arrows so a cluster of stop-and-go events does not fill in solid.
 *
 * Projection is taken at an explicit zoom rather than through the map's current
 * layer origin, which makes the whole calculation a pure function of the points
 * and the zoom — so it recomputes on zoom and is correctly indifferent to pan.
 *
 * `zIndexOffset` places the arrows among other markers in the same pane; the
 * fleet map passes a negative one so device markers and their names stay on top.
 */
export function DirectionArrows({
  points,
  zIndexOffset = 0,
}: {
  points: { lat: number; lon: number }[];
  zIndexOffset?: number;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const arrows = useMemo(() => {
    if (points.length < 2) return [];

    const out: { key: string; lat: number; lon: number; angle: number }[] = [];
    let lastPlaced: L.Point | null = null;

    for (let i = 1; i < points.length; i += 1) {
      const from = map.project([points[i - 1].lat, points[i - 1].lon], zoom);
      const to = map.project([points[i].lat, points[i].lon], zoom);

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (Math.hypot(dx, dy) < MIN_SEGMENT_PX) continue;

      const mid = L.point((from.x + to.x) / 2, (from.y + to.y) / 2);
      if (lastPlaced && mid.distanceTo(lastPlaced) < MIN_ARROW_GAP_PX) continue;

      // Back to lat/lng through the same projection, so the arrow lands exactly
      // on the straight line Leaflet actually drew rather than near it.
      const at = map.unproject(mid, zoom);
      out.push({
        key: `${points[i - 1].lat},${points[i - 1].lon}-${i}`,
        lat: at.lat,
        lon: at.lng,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });

      lastPlaced = mid;
      if (out.length >= MAX_ARROWS) break;
    }

    return out;
  }, [points, map, zoom]);

  return (
    <>
      {arrows.map((arrow) => (
        <Marker
          key={arrow.key}
          position={[arrow.lat, arrow.lon]}
          icon={arrowIcon(arrow.angle)}
          zIndexOffset={zIndexOffset}
          /* Decoration only. Left interactive, these sit in the marker pane
             above the event dots and would swallow clicks meant for them. */
          interactive={false}
          keyboard={false}
        />
      ))}
    </>
  );
}
