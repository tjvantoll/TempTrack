"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { formatDistance, pathLengthMeters } from "@/lib/track";
import type { Unit } from "@/lib/temperature";
import type { TrackPoint } from "@/lib/notehub";

/**
 * Leaflet reads `window` at module scope, so the map cannot be part of the
 * server render at all. The skeleton stands in at the map's own height to keep
 * the layout from jumping when it arrives.
 */
const TrackMap = dynamic(() => import("@/components/TrackMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const stamp = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function LocationPanel({ points, unit }: { points: TrackPoint[]; unit: Unit }) {
  const lastIndex = Math.max(points.length - 1, 0);

  /**
   * The two ends of the shown range, as positions in the track rather than
   * timestamps. Tracking events are unevenly spaced — dense while the device
   * moves, one a day while it sits still — so a time-based handle would spend
   * most of its travel crossing empty hours. Indexes give every event the same
   * slice of the rail; the labels carry the dates.
   */
  const [rawLow, setLow] = useState(0);
  const [rawHigh, setHigh] = useState(lastIndex);

  /*
   * Clamped on read, not just reset in the effect below.
   *
   * A range change hands this component a shorter `points` array while the
   * handles still hold indexes from the longer one. The reset is an effect, so
   * it runs *after* the render that already tried to read `points[high]` — one
   * render is enough to index off the end and crash. Clamping makes that
   * in-between render safe; the effect still restores the full range after it.
   */
  const low = Math.min(rawLow, lastIndex);
  const high = Math.min(rawHigh, lastIndex);

  /** The event whose popup is open, if any. */
  const [selected, setSelected] = useState<number | null>(null);

  // A new window is a different track; reset rather than holding handles that
  // now point at unrelated events.
  const trackKey = points.length
    ? `${points.length}:${points[0].t}:${points[lastIndex].t}`
    : "empty";
  const seenKey = useRef(trackKey);
  useEffect(() => {
    if (seenKey.current === trackKey) return;
    seenKey.current = trackKey;
    setLow(0);
    setHigh(Math.max(points.length - 1, 0));
    setSelected(null);
  }, [trackKey, points.length]);

  /**
   * An event dragged out of range is no longer on the map, so its popup should
   * not be either. Derived rather than synced through an effect: clearing the
   * state would need an extra render, and the remembered selection is worth
   * keeping — widening the range back out reopens the popup where it was.
   */
  const openIndex = selected !== null && selected >= low && selected <= high ? selected : null;

  const visible = useMemo(
    () => points.slice(low, high + 1).map((point, offset) => ({ point, index: low + offset })),
    [points, low, high],
  );

  const pathLength = useMemo(
    () => pathLengthMeters(visible.map((entry) => entry.point)),
    [visible],
  );

  if (!points.length) {
    return (
      <div className="rounded-xl border border-line bg-surface-alt px-5 py-4 text-sm text-muted">
        Notehub has no <code className="font-mono text-xs">_track.qo</code> events for this device in
        this window. The Notecard needs a view of the sky to reach the GPS satellites, so a tracker
        that has only ever been indoors will have no location history — and a stationary one only
        reports once every 24 hours.
      </div>
    );
  }

  const showingAll = low === 0 && high === lastIndex;
  const shown = high - low + 1;

  // Clamped rather than allowed to cross, so the two handles keep their meaning.
  const onLow = (value: number) => setLow(Math.min(value, high));
  const onHigh = (value: number) => setHigh(Math.max(value, low));

  /**
   * Which handle sits on top matters only when they collide. The one on top is
   * the one a drag reaches, so it has to be the one with somewhere to go: at the
   * right edge that is the low handle, everywhere else the high handle.
   */
  const lowOnTop = low === high && high === lastIndex;

  const span = lastIndex === 0 ? { left: 0, width: 100 } : {
    left: (low / lastIndex) * 100,
    width: ((high - low) / lastIndex) * 100,
  };

  const labelFor = (index: number) => stamp.format(points[index].t);

  return (
    <div className="space-y-4">
      <div className="h-[380px] overflow-hidden rounded-xl border border-line sm:h-[460px] lg:h-[560px]">
        <TrackMap
          all={points}
          visible={visible}
          selectedIndex={openIndex}
          onSelect={setSelected}
          unit={unit}
        />
      </div>

      <div className="rounded-xl border border-line bg-surface px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-sm font-medium text-ink">Shown on the map</span>
          <p className="tnum text-sm text-muted">
            {labelFor(low)}
            <span className="px-1.5 opacity-50">→</span>
            {labelFor(high)}
          </p>
        </div>

        <div className="range-slider mt-3">
          <div className="range-slider-rail" aria-hidden />
          <div
            className="range-slider-span"
            style={{ left: `${span.left}%`, width: `${span.width}%` }}
            aria-hidden
          />
          <input
            type="range"
            min={0}
            max={lastIndex}
            step={1}
            value={low}
            disabled={points.length < 2}
            onChange={(event) => onLow(Number(event.target.value))}
            aria-label="Earliest tracking event shown"
            aria-valuetext={labelFor(low)}
            style={{ zIndex: lowOnTop ? 4 : 3 }}
          />
          <input
            type="range"
            min={0}
            max={lastIndex}
            step={1}
            value={high}
            disabled={points.length < 2}
            onChange={(event) => onHigh(Number(event.target.value))}
            aria-label="Latest tracking event shown"
            aria-valuetext={labelFor(high)}
            style={{ zIndex: lowOnTop ? 3 : 4 }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted">
          <span className="tnum">{labelFor(0)}</span>
          <span>
            {shown === 1 ? "1 tracking event" : `${shown.toLocaleString()} tracking events`}
            {shown !== points.length && ` of ${points.length.toLocaleString()}`}
            {shown > 1 && ` · ${formatDistance(pathLength)}`}
          </span>
          <span className="tnum">{labelFor(lastIndex)}</span>
        </div>

        <p className="mt-3 text-xs text-muted">
          Drag either handle to narrow what the map draws. Click any point for its details.
          {!showingAll && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => {
                  setLow(0);
                  setHigh(lastIndex);
                }}
                className="text-primary underline underline-offset-2 hover:text-[var(--primary-hover)]"
              >
                Show all
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
