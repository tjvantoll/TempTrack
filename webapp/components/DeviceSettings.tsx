"use client";

import { useState } from "react";
import {
  DeviceSettingsForm,
  type InitialSettings,
  type StoredSettings,
} from "@/components/DeviceSettingsForm";
import { thresholdInputValue } from "@/lib/temperature";
import { useUnit } from "@/lib/unit-preference";

/**
 * Seeds the settings form in the viewer's unit. The unit lives in the browser,
 * so the server hands over Celsius and the conversion to input values happens
 * here.
 */
export function DeviceSettings({ deviceUid, stored }: { deviceUid: string; stored: StoredSettings }) {
  const unit = useUnit();
  // Updated on save, so switching unit afterwards shows what was just saved.
  const [current, setCurrent] = useState(stored);

  const initial: InitialSettings = {
    name: current.name,
    minEnabled: current.minC !== null,
    maxEnabled: current.maxC !== null,
    // A disabled bound has no temperature to show. Leaving it blank rather than
    // rendering the sentinel keeps -999 out of the interface entirely.
    minValue: current.minC !== null ? thresholdInputValue(current.minC, unit) : "",
    maxValue: current.maxC !== null ? thresholdInputValue(current.maxC, unit) : "",
    recheck: current.recheck,
  };

  return (
    /* Keyed on the unit so switching it re-seeds the inputs in the new unit;
       the page keys this component on the device for the same reason. */
    <DeviceSettingsForm
      key={unit}
      deviceUid={deviceUid}
      unit={unit}
      initial={initial}
      onSaved={setCurrent}
    />
  );
}
