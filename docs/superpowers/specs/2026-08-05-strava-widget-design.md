# Strava Activity Widget — Design

## Goal

Show the athlete's latest 3 Strava activities on the Sport page, each with a
Google Static Maps route image and key stats (distance, average speed,
average heart rate, moving time), without introducing a second runtime or
moving the site off its static-first architecture (see
[ADR 0001](../../adr/0001-astro-tailwind-shadcn.md)).

## Architecture

**Trigger:** a scheduled GitHub Actions workflow, `cron: '0 6 * * *'` (once
daily). Frequency can be increased later at no extra cost since GitHub
Actions cron on a public repo is free regardless of interval — unlike
Vercel's own Cron Jobs, which cap the Hobby (free) plan at once per day.

**Runtime:** TypeScript on Node.js, run via `tsx` in the workflow. Matches
the rest of the project's stack (Astro/TS) — no Python or second toolchain.

**Why not Vercel Functions + Vercel Cron:** would require switching part of
the site from static to dynamic/on-demand rendering, adding a data store
(e.g. Vercel Blob), and (for more-than-daily runs) the Vercel Pro plan.
GitHub Actions + a committed data file keeps the site fully static and free.

### Workflow steps

1. Exchange the stored Strava `refresh_token` for a fresh access token via
   `POST https://www.strava.com/oauth/token`.
2. Fetch the latest 3 activities via `GET /athlete/activities` (Strava API).
3. For each activity: decode its `summary_polyline`, build a Google Static
   Maps URL (`path=` parameter) with the Maps API key, download the
   resulting PNG.
4. Diff against the previously committed `strava-activities.json`. If
   nothing changed (same activity IDs), stop here — no commit, no deploy.
5. Write:
   - `src/data/strava-activities.json` — stats for the 3 activities
   - `public/images/strava/activity-<id>.png` — one map image per activity
6. Commit and push the changes to `main`.
7. `POST` the Vercel Deploy Hook URL to trigger a production rebuild.

**Note on deploys:** the Vercel project is currently *not* connected to
GitHub for auto-deploy-on-push (confirmed: 3 merged PRs produced zero new
deployments — the only deployment on record is a manual `vercel --prod` from
before this work). Step 7 is therefore required, not optional; without it,
new data would sit in the repo without ever reaching production. If GitHub
auto-deploy is set up later, step 7 becomes redundant but harmless.

### Data model

`src/data/strava-activities.json`, always exactly 3 entries, newest first,
fully overwritten each run:

```json
[
  {
    "id": 123456789,
    "name": "Morning Ride",
    "date": "2026-08-04T06:12:00Z",
    "distanceKm": 42.3,
    "avgSpeedKmh": 28.1,
    "avgHeartRate": 142,
    "movingTimeMinutes": 91,
    "mapImage": "/images/strava/activity-123456789.png"
  }
]
```

`mapImage` is optional — omitted if the Google Static Maps request for that
activity fails (see Error Handling).

### Frontend

An Astro component on `src/pages/freizeit/sport/index.astro` reads
`strava-activities.json` at build time (same pattern as the existing content
collections) and renders 3 cards: map image (if present) + stats. Replaces
the previously commented-out Strava embed script/iframe.

## Error Handling

- **Token refresh fails** (revoked/expired refresh token): workflow exits
  non-zero. GitHub surfaces the failed run; no commit happens, no bad data
  reaches production.
- **Strava API rate-limited or unavailable**: same — fail loudly, skip the
  run entirely. Previously published data stays live.
- **Google Static Maps request fails for one activity**: does not fail the
  whole run. That entry's `mapImage` is omitted; the frontend renders the
  stats card without a map. A warning is logged in the workflow run.
- **No new activities since last run**: no-op — skip commit and deploy hook
  call, avoiding wasted Vercel builds.

## Testing

- Vitest unit tests (same suite as `src/content.config.test.ts`) covering:
  - Polyline → Google Static Maps URL construction
  - `strava-activities.json` shape validation
  - "did anything change" diff logic
  - Astro component rendering gracefully when `mapImage` is missing
- No live-API integration test in CI (would require real secrets and burn
  Strava/Google quota on every push). Verified manually via a
  `workflow_dispatch` run before relying on the schedule.

## One-time manual setup (not automated by this design)

- Register/authorize the existing Strava app via the OAuth browser flow once
  to obtain `STRAVA_REFRESH_TOKEN`.
- Create a GCP project + API key scoped to the Maps Static API only
  (`GOOGLE_MAPS_API_KEY`), billing enabled (expected cost: ~$0/month at 3
  requests/day).
- Create a Vercel Deploy Hook for the `homepage` project
  (`VERCEL_DEPLOY_HOOK_URL`).
- Add all secrets to the GitHub repo: `STRAVA_CLIENT_ID`,
  `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`, `GOOGLE_MAPS_API_KEY`,
  `VERCEL_DEPLOY_HOOK_URL`.

## Out of scope (for this iteration)

- More than 3 activities.
- Sub-daily refresh cadence (can be revisited later — cost analysis above
  still holds at higher frequency since GitHub Actions cron stays free).
- Automatic Vercel GitHub integration (would make step 7 redundant, not
  addressed here).
