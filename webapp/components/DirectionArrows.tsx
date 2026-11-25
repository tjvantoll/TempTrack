"use client";

import { useMemo, useState } from "react";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

/** Distance between arrows along the line, in screen pixels. */
const ARROW_SPACING_PX = 70;
/** A line shorter than this on screen gets no arrow at all. */
const MIN_LINE_PX = 24;
/** How far behind and ahead of an arrow the line is sampled for its heading. */
const HEADING_SPAN_PX = 12;
/**
 * Straight-line distance over the sampled span, as a share of the distance
 * along the line. Below it the line is doubling back (a cluster of
 * stop-and-go fixes), where any heading would be noise, so no arrow.
 */
const MIN_STRAIGHTNESS = 0.7;
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
 * the only space where "is there room for an arrow here" has an answer. Arrows
 * go at a fixed spacing along the whole line, not per segment: on the fleet
 * map a five-minute segment is a few pixels long, so a per-segment rule never
 * places one. Each arrow points along the line around it, and is skipped where
 * the line folds back on itself so a stop-and-go cluster does not fill in.
 * Spacing is measured from the start, so arrows stay put as a journey grows.
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

    const screen = points.map((point) => map.project([point.lat, point.lon], zoom));
    // Distance along the line to each point.
    const along = [0];
    for (let i = 1; i < screen.length; i += 1) {
      along.push(along[i - 1] + screen[i].distanceTo(screen[i - 1]));
    }
    const total = along[along.length - 1];
    if (total < MIN_LINE_PX) return [];

    // The screen point `d` pixels along the line.
    const at = (d: number): L.Point => {
      let lo = 0;
      let hi = along.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (along[mid] <= d) lo = mid;
        else hi = mid;
      }
      const span = along[hi] - along[lo];
      const t = span > 0 ? (d - along[lo]) / span : 0;
      return L.point(
        screen[lo].x + (screen[hi].x - screen[lo].x) * t,
        screen[lo].y + (screen[hi].y - screen[lo].y) * t,
      );
    };

    // One arrow mid-line on a short line, otherwise one every ARROW_SPACING_PX.
    const offsets: number[] = [];
    if (total < ARROW_SPACING_PX) {
      offsets.push(total / 2);
    } else {
      for (let d = ARROW_SPACING_PX / 2; d < total && offsets.length < MAX_ARROWS; d += ARROW_SPACING_PX) {
        offsets.push(d);
      }
    }

    const out: { key: string; lat: number; lon: number; angle: number }[] = [];
    for (const d of offsets) {
      const startD = Math.max(0, d - HEADING_SPAN_PX);
      const endD = Math.min(total, d + HEADING_SPAN_PX);
      const from = at(startD);
      const to = at(endD);
      if (from.distanceTo(to) < MIN_STRAIGHTNESS * (endD - startD)) continue;

      // Back to lat/lng through the same projection, so the arrow lands exactly
      // on the line Leaflet actually drew rather than near it.
      const position = map.unproject(at(d), zoom);
      out.push({
        key: `${d}`,
        lat: position.lat,
        lon: position.lng,
        angle: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
      });
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
