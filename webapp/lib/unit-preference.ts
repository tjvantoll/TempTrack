"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_UNIT, UNITS, type Unit } from "./temperature";

/**
 * The display unit, remembered per browser in localStorage.
 *
 * It is a viewing preference rather than part of what a page shows, so it is
 * not in the URL: a shared link opens in the reader's own unit. The catch is
 * that the server cannot see localStorage, so it renders the default and the
 * stored unit takes over on hydration. Server components therefore hand
 * temperatures down in Celsius and leave every conversion to the client.
 */

const STORAGE_KEY = "temptrack.unit";
/** Same-tab changes. The `storage` event only fires in *other* tabs. */
const CHANGE_EVENT = "temptrack:unit";

/** Holds the choice for this page view when storage refuses to. */
let memoryFallback: Unit | null = null;

function read(): Unit {
  if (memoryFallback) return memoryFallback;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return UNITS.includes(value as Unit) ? (value as Unit) : DEFAULT_UNIT;
  } catch {
    // Storage can be blocked (private mode, site data off); fall back quietly.
    return DEFAULT_UNIT;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useUnit(): Unit {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_UNIT);
}

export function setUnit(unit: Unit) {
  try {
    window.localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // Not persisted, but the page still switches for this visit.
    memoryFallback = unit;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
