# TempTrack web dashboard

A dashboard for a fleet of TempTrack trackers. It shows where every device is,
and for each one where it has been, the temperatures it reported, and any
temperature alerts it sent — and lets you change the settings it runs on.

## Setup

1. **Create a Notehub personal access token.** Sign in at
   [notehub.io](https://notehub.io) → user menu (top right) → **API Access** →
   **Create New Token**. Copy the token; it is only shown once.

2. **Find your project UID.** It is on the Notehub project's Settings page and
   looks like `app:00000000-0000-0000-0000-000000000000`.

3. **Configure the app.**

   ```bash
   cp .env.local.example .env.local
   # then fill in NOTEHUB_PAT and NOTEHUB_PROJECT_UID
   ```

4. **Run it.**

   ```bash
   pnpm install
   pnpm dev
   ```

   Open <http://localhost:3000>.

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `NOTEHUB_PAT` | yes | Notehub personal access token, sent as a bearer token |
| `NOTEHUB_PROJECT_UID` | yes | Project to read from, e.g. `app:…` |

The token is only ever read on the server, so it never reaches the browser.

## Pages

**Fleet** (`/`) — every device in the project on one map and in one list, with
its latest temperature, most recent alert and when it was last seen. Devices
that alerted in the last 24 hours are marked in red. Select a device to open
its pages.

**Device dashboard** (`/devices/<uid>`) — the latest temperature, voltage and
signal strength; a map of where the device has been, with a two-handle slider
to narrow which tracking events it draws; recent temperature alerts; and
connectivity history.

**Device settings** (`/devices/<uid>/settings`) — rename the device, set the
high and low temperature thresholds, and choose how long the device waits after
an alert before checking again.
