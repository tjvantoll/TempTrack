"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocationDetails } from "@/components/LocationDetails";
import { trackBounds, trail, type LatLng } from "@/lib/track";
import { formatRelative } from "@/lib/time-ranges";
import type { Unit } from "@/lib/temperature";
import type { TrackPoint } from "@/lib/notehub";

/**
 * OpenStreetMap's public tile server. Free and keyless, and its usage policy
 * asks for attribution and no heavy automated traffic — fine for a dashboard
 * one person opens, not something to point a fleet view at.
 */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const stamp = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** An event in range, carrying its position in the full track. */
export type VisibleEvent = { point: TrackPoint; index: number };

/**
 * Leaflet's default marker resolves its icon through image URLs that break
 * under a bundler. A divIcon sidesteps the asset problem entirely and themes
 * with the rest of the page — see `.track-marker` in globals.css.
 */
function newestIcon() {
  return L.divIcon({
    className: "",
    html: '<div class="track-marker track-marker-pulse"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

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
 * Direction arrows along the path.
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
 */
function DirectionArrows({ points }: { points: TrackPoint[] }) {
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
        key: `${points[i - 1].t}-${i}`,
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
          /* Decoration only. Left interactive, these sit in the marker pane
             above the event dots and would swallow clicks meant for them. */
          interactive={false}
          keyboard={false}
        />
      ))}
    </>
  );
}

/**
 * Fit the viewport to the whole track, once.
 *
 * Deliberately not refitted when the range narrows. Narrowing is how you ask
 * "what happened between these two times", and the answer is read by watching
 * events drop off the map in place — re-zooming on every handle movement
 * destroys exactly that reading, and drags the map around under the hand
 * holding the slider.
 */
function Viewport({ points }: { points: TrackPoint[] }) {
  const map = useMap();
  const fittedKey = useRef<string | null>(null);

  const trackKey = points.length
    ? `${points.length}:${points[0].t}:${points[points.length - 1].t}`
    : "empty";

  useEffect(() => {
    if (fittedKey.current === trackKey) return;
    fittedKey.current = trackKey;

    const bounds = trackBounds(points);
    if (bounds) map.fitBounds(bounds, { animate: false });
  }, [map, points, trackKey]);

  return null;
}

export default function TrackMap({
  all,
  visible,
  selectedIndex,
  onSelect,
  unit,
}: {
  /** Every event in the window. Sets the initial viewport. */
  all: TrackPoint[];
  /** The events currently in range — the only ones drawn. */
  visible: VisibleEvent[];
  /** Index of the event whose popup is open, or null. */
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  unit: Unit;
}) {
  const line = useMemo(() => trail(visible.map((entry) => entry.point)), [visible]);
  const icon = useMemo(() => newestIcon(), []);

  const newest = visible.length ? visible[visible.length - 1] : null;
  const selected = visible.find((entry) => entry.index === selectedIndex) ?? null;

  const center: LatLng = newest
    ? [newest.point.lat, newest.point.lon]
    : all.length
      ? [all[0].lat, all[0].lon]
      : [0, 0];

  return (
    <MapContainer className="track-map" center={center} zoom={13} scrollWheelZoom>
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />

      {line.length > 1 && (
        /* Geometry is colored through a class rather than pathOptions: Leaflet
           writes those onto the SVG as presentation attributes, where a
           `var()` reference is not reliably resolved. */
        <Polyline positions={line} pathOptions={{ className: "track-line", weight: 3 }} />
      )}

      {visible.length > 1 && <DirectionArrows points={visible.map((entry) => entry.point)} />}

      {visible.map((entry) =>
        /* The newest event in range gets its own marker below, so it is skipped
           here rather than drawn twice. */
        entry.index === newest?.index ? null : (
          <CircleMarker
            /*
             * Keyed on the index rather than the timestamp: two `_track.qo`
             * events can carry the same capture time, and a duplicate key lets
             * React drop one of them.
             *
             * The selected state is part of the key on purpose. Leaflet applies
             * `className` when it creates the path and `setStyle` never touches
             * it again, so a class swap alone would not reach the DOM —
             * remounting the one or two affected markers does, and costs
             * nothing next to restyling the whole track.
             */
            key={`${entry.index}:${entry.index === selectedIndex}`}
            center={[entry.point.lat, entry.point.lon]}
            radius={entry.index === selectedIndex ? 6 : 4}
            pathOptions={{
              className: entry.index === selectedIndex ? "track-event-selected" : "track-event",
              weight: entry.index === selectedIndex ? 2 : 1.5,
            }}
            eventHandlers={{ click: () => onSelect(entry.index) }}
          />
        ),
      )}

      {newest && (
        <Marker
          position={[newest.point.lat, newest.point.lon]}
          icon={icon}
          eventHandlers={{ click: () => onSelect(newest.index) }}
        />
      )}

      {/*
        Details open on the event itself rather than in a panel beside the map,
        so the numbers sit next to the place they describe. A single positioned
        popup, not one per marker — mounting a detail table for every event in a
        150-event track costs far more than it saves.
      */}
      {selected && (
        <Popup
          position={[selected.point.lat, selected.point.lon]}
          minWidth={250}
          maxWidth={300}
          /* Leaflet scrolls its own content past this, so a heartbeat event
             with an unusually full field set cannot outgrow the map. */
          maxHeight={280}
          autoPan
          eventHandlers={{ remove: () => onSelect(null) }}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3 pr-4">
            <span className="text-sm font-semibold text-ink">
              {selected.index === newest?.index ? "Latest event" : "Tracking event"}
            </span>
            <time
              dateTime={new Date(selected.point.t).toISOString()}
              className="tnum shrink-0 text-xs text-muted"
            >
              {stamp.format(selected.point.t)}
            </time>
          </div>
          <p className="mb-2 text-xs text-muted">{formatRelative(selected.point.t)}</p>
          <LocationDetails point={selected.point} unit={unit} compact />
        </Popup>
      )}

      <Viewport points={all} />
    </MapContainer>
  );
}
