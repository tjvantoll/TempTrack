# TempTrack web dashboard

A dashboard for the TempTrack tracker. It shows where the device has been, the
temperatures it reported, and any temperature alerts it sent — and lets you
change the settings it runs on.

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
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>.

### Environment variables

| Name | Required | Purpose |
|---|---|---|
| `NOTEHUB_PAT` | yes | Notehub personal access token, sent as a bearer token |
| `NOTEHUB_PROJECT_UID` | yes | Project to read from, e.g. `app:…` |
| `NOTEHUB_DEVICE_UID` | no | Pin the dashboard to one device instead of auto-selecting |

The token is only ever read on the server, so it never reaches the browser.

## The two pages

**Dashboard** — the latest temperature, voltage and signal strength; a map of
where the device has been, with a two-handle slider to narrow which tracking
events it draws; recent temperature alerts; and connectivity history.

**Settings** — rename the device, set the high and low temperature thresholds,
and choose how long the device waits after an alert before checking again.
