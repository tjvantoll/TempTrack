import { NextResponse } from "next/server";
import {
  NotehubApiError,
  NotehubConfigError,
  getEnvironmentVariables,
  resolveDevice,
  setEnvironmentVariables,
} from "@/lib/notehub";
import {
  EDITABLE_VARS,
  TEMP_MAX_DEFAULT,
  TEMP_MAX_DISABLED,
  TEMP_MAX_VAR,
  TEMP_MIN_DEFAULT,
  TEMP_MIN_DISABLED,
  TEMP_MIN_VAR,
  validateSetting,
  validateThresholdPair,
} from "@/lib/env-vars";

export const dynamic = "force-dynamic";

function fail(error: unknown) {
  if (error instanceof NotehubConfigError) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (error instanceof NotehubApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 502 });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}

async function deviceUidFor(requested: string | null): Promise<string | null> {
  if (requested) return requested;
  const resolved = await resolveDevice();
  return resolved?.device.uid ?? null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const deviceUid = await deviceUidFor(url.searchParams.get("device"));
    if (!deviceUid) return NextResponse.json({ error: "No device available." }, { status: 404 });
    return NextResponse.json({ variables: await getEnvironmentVariables(deviceUid) });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as {
      device?: string;
      variables?: Record<string, unknown>;
    };

    const variables = payload.variables;
    if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
      return NextResponse.json({ error: "Expected a `variables` object." }, { status: 400 });
    }

    // Only the settings the app exposes may be written, and the server
    // validates them independently of the browser.
    const clean: Record<string, string> = {};
    for (const [rawName, rawValue] of Object.entries(variables)) {
      const name = rawName.trim();
      if (!EDITABLE_VARS.includes(name)) {
        return NextResponse.json({ error: `${name} is not an editable setting.` }, { status: 400 });
      }
      const result = validateSetting(name, String(rawValue ?? ""));
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      clean[name] = result.value;
    }

    if (!Object.keys(clean).length) {
      return NextResponse.json({ error: "No settings supplied." }, { status: 400 });
    }

    const deviceUid = await deviceUidFor(payload.device ?? null);
    if (!deviceUid) return NextResponse.json({ error: "No device available." }, { status: 404 });

    /**
     * The threshold pair has to be checked against what the device will
     * actually end up with, not just against what this request carries. A
     * request that moves only the low threshold can still invert the band, and
     * the per-field validators cannot see across fields.
     */
    if (clean[TEMP_MIN_VAR] !== undefined || clean[TEMP_MAX_VAR] !== undefined) {
      const current = await getEnvironmentVariables(deviceUid);
      const resolve = (name: string, fallback: number) => {
        const raw = clean[name] ?? current[name];
        const value = Number(raw);
        return raw !== undefined && Number.isFinite(value) ? value : fallback;
      };

      const minC = resolve(TEMP_MIN_VAR, TEMP_MIN_DEFAULT);
      const maxC = resolve(TEMP_MAX_VAR, TEMP_MAX_DEFAULT);

      // A disabled bound cannot invert anything — the sentinels are already
      // past every real temperature, in the direction that makes the band open.
      const minActive = minC !== TEMP_MIN_DISABLED;
      const maxActive = maxC !== TEMP_MAX_DISABLED;
      if (minActive && maxActive) {
        const conflict = validateThresholdPair(minC, maxC);
        if (conflict) return NextResponse.json({ error: conflict }, { status: 400 });
      }
    }

    return NextResponse.json({ variables: await setEnvironmentVariables(deviceUid, clean) });
  } catch (error) {
    return fail(error);
  }
}
