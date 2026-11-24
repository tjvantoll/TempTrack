"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DirectionArrows } from "@/components/DirectionArrows";
import { LocationDetails } from "@/components/LocationDetails";
import { trackBounds, trail, type LatLng } from "@/lib/track";
import { formatRelative } from "@/lib/time-ranges";
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
}: {
  /** Every event in the window. Sets the initial viewport. */
  all: TrackPoint[];
  /** The events currently in range — the only ones drawn. */
  visible: VisibleEvent[];
  /** Index of the event whose popup is open, or null. */
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
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
           `var()` reference is not reliably resolved.

           `className` has to be a prop of its own. react-leaflet hands
           `pathOptions` to `setStyle`, which ignores class names, so one
           placed there never reaches the SVG. */
        <Polyline positions={line} className="track-line" pathOptions={{ weight: 3 }} />
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
            className={entry.index === selectedIndex ? "track-event-selected" : "track-event"}
            pathOptions={{ weight: entry.index === selectedIndex ? 2 : 1.5 }}
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
          <LocationDetails point={selected.point} compact />
        </Popup>
      )}

      <Viewport points={all} />
    </MapContainer>
  );
}
