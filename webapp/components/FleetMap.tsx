"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DirectionArrows } from "@/components/DirectionArrows";
import { deviceHref } from "@/lib/device-url";
import type { FleetDevice, FleetMapProps } from "@/lib/fleet";
import { formatRelative } from "@/lib/time-ranges";
import { fromCelsius, unitLabel, type Unit } from "@/lib/temperature";
import { useUnit } from "@/lib/unit-preference";
import { formatDistance, trackBounds } from "@/lib/track";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const stamp = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Wide enough that a lone device shows its surroundings, not one street. */
const SINGLE_DEVICE_PAD_DEGREES = 0.05;

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * A dot with the device's name beside it, so the map reads without clicking.
 * A divIcon themes with the page and needs no image assets — see `.fleet-marker`
 * in globals.css.
 */
function deviceIcon(device: FleetDevice, alerting: boolean) {
  return L.divIcon({
    className: "",
    html:
      `<div class="fleet-marker${alerting ? " fleet-marker-alert" : ""}">` +
      '<span class="fleet-marker-dot"></span>' +
      `<span class="fleet-marker-label">${escapeHtml(device.name)}</span>` +
      "</div>",
    iconSize: [0, 0],
    iconAnchor: [8, 8],
  });
}

/**
 * Fit every device — and every current journey — on screen when the set of
 * positions changes, not on every render.
 */
function Viewport({ devices }: { devices: FleetDevice[] }) {
  const map = useMap();
  const fittedKey = useRef<string | null>(null);

  const points = devices.flatMap((d) => [
    ...(d.journey?.path ?? []).map(([lat, lon]) => ({ lat, lon })),
    { lat: d.lat as number, lon: d.lon as number },
  ]);
  const key = points.map((p) => `${p.lat},${p.lon}`).join("|");

  useEffect(() => {
    if (fittedKey.current === key) return;
    fittedKey.current = key;
    const bounds = trackBounds(points, SINGLE_DEVICE_PAD_DEGREES);
    if (bounds) map.fitBounds(bounds, { animate: false, padding: [24, 24] });
  }, [map, key, points]);

  return null;
}

/**
 * A device's trip so far: the path with direction arrows, plus a hollow dot
 * where it set out. The device's own marker covers the other end. Styled
 * through the same classes and arrows as the device dashboard's track so a
 * journey looks the same on both maps.
 */
function JourneyLine({ device }: { device: FleetDevice }) {
  const journey = device.journey;
  const arrowPoints = useMemo(() => (journey?.path ?? []).map(([lat, lon]) => ({ lat, lon })), [journey]);
  if (!journey || !journey.path.length) return null;

  return (
    <>
      {journey.path.length > 1 && (
        <>
          <Polyline
            positions={journey.path}
            className="track-line"
            pathOptions={{ weight: 3 }}
            interactive={false}
          />
          {/* Under the device markers, which share their pane, so arrows never cover a name. */}
          <DirectionArrows points={arrowPoints} zIndexOffset={-1000} />
        </>
      )}
      {/* Interactive only so it can be hovered for its tooltip. */}
      <CircleMarker
        center={journey.path[0]}
        radius={5}
        // A prop of its own: react-leaflet passes pathOptions to setStyle,
        // which ignores className.
        className="journey-start"
        pathOptions={{ weight: 2 }}
        bubblingMouseEvents={false}
      >
        <Tooltip direction="top" offset={[0, -6]} opacity={1}>
          <p className="font-semibold text-ink">Journey start · {device.name}</p>
          <p className="text-muted">
            {stamp.format(journey.startedMs)} · {formatRelative(journey.startedMs)}
          </p>
        </Tooltip>
      </CircleMarker>
    </>
  );
}

/** "Too cold 4 hr ago · cleared", for the tooltip and popup alike. */
function alertSummary(device: FleetDevice): string {
  const alert = device.latestAlert;
  if (!alert) return "";
  const what = alert.direction === "hot" ? "Too hot" : alert.direction === "cold" ? "Too cold" : "Alert";
  return `${what} ${formatRelative(alert.t)} · ${device.alertState === "active" ? "still active" : "cleared"}`;
}

/** A one-glance summary of the device, shown on hover. The popup has the rest. */
function DeviceTooltip({ device, unit }: { device: FleetDevice; unit: Unit }) {
  const parts: string[] = [];
  if (device.temperatureC !== null) {
    parts.push(`${fromCelsius(device.temperatureC, unit).toFixed(1)} ${unitLabel(unit)}`);
  }
  parts.push(
    device.journey
      ? `On a journey · ${formatDistance(device.journey.distanceM)}`
      : device.locationMs !== null
        ? `Located ${formatRelative(device.locationMs)}`
        : "Parked",
  );

  return (
    <Tooltip direction="top" offset={[0, -12]} opacity={1}>
      <p className="font-semibold text-ink">{device.name}</p>
      {device.location && <p className="text-muted">{device.location}</p>}
      <p className="text-ink">{parts.join(" · ")}</p>
      {device.latestAlert && device.alertState && (
        <p style={{ color: device.alertState === "active" ? "var(--alert-ink)" : "var(--text-muted)" }}>
          {alertSummary(device)}
        </p>
      )}
      <p className="mt-1 text-muted">Click for details</p>
    </Tooltip>
  );
}

export default function FleetMap({ devices }: FleetMapProps) {
  const unit = useUnit();
  const placed = useMemo(() => devices.filter((d) => d.lat !== null && d.lon !== null), [devices]);
  /**
   * The device whose popup is open. Its tooltip is left out meanwhile — both
   * open above the marker, and the popup already says everything it would.
   */
  const [openUid, setOpenUid] = useState<string | null>(null);

  return (
    <MapContainer className="track-map" center={[39.5, -98.35]} zoom={4} scrollWheelZoom>
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />

      {/* Journeys first, so the device markers sit on top of their own lines. */}
      {placed.map((device) => (
        <JourneyLine key={`journey:${device.uid}`} device={device} />
      ))}

      {placed.map((device) => {
        const alerting = device.alertState === "active";
        return (
          <Marker
            key={device.uid}
            position={[device.lat as number, device.lon as number]}
            icon={deviceIcon(device, alerting)}
            eventHandlers={{
              popupopen: () => setOpenUid(device.uid),
              popupclose: () => setOpenUid((uid) => (uid === device.uid ? null : uid)),
            }}
          >
            {openUid !== device.uid && <DeviceTooltip device={device} unit={unit} />}
            <Popup minWidth={200} maxWidth={260}>
              <p className="text-sm font-semibold text-ink">{device.name}</p>
              {device.location && <p className="text-xs text-muted">{device.location}</p>}
              <dl className="mt-2 space-y-1 text-xs">
                {device.temperatureC !== null && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Temperature</dt>
                    <dd className="tnum text-ink">
                      {fromCelsius(device.temperatureC, unit).toFixed(1)} {unitLabel(unit)}
                    </dd>
                  </div>
                )}
                {device.journey && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Journey</dt>
                    <dd className="text-ink">
                      {formatDistance(device.journey.distanceM)} · started {formatRelative(device.journey.startedMs)}
                    </dd>
                  </div>
                )}
                {device.locationMs !== null && !device.journey && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Located</dt>
                    <dd className="text-ink">{formatRelative(device.locationMs)}</dd>
                  </div>
                )}
                {device.latestAlert && device.alertState && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Last alert</dt>
                    <dd
                      className="text-right"
                      style={{ color: alerting ? "var(--alert-ink)" : "var(--text)" }}
                    >
                      {alertSummary(device)}
                    </dd>
                  </div>
                )}
              </dl>
              <Link
                href={deviceHref(device.uid)}
                className="mt-3 inline-block text-sm font-medium text-primary hover:text-[var(--primary-hover)]"
              >
                Open dashboard →
              </Link>
            </Popup>
          </Marker>
        );
      })}

      <Viewport devices={placed} />
    </MapContainer>
  );
}
