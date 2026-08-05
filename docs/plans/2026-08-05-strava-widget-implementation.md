# Strava Activity Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the athlete's latest 3 Strava activities on the Sport page, each with a Google Static Maps route image and key stats, kept fresh by a daily GitHub Actions cron job — no change to the site's static architecture.

**Architecture:** A standalone TypeScript script (`scripts/strava-sync/`), run by a scheduled GitHub Actions workflow, refreshes a Strava access token, fetches the latest 3 activities, downloads a Google Static Maps image per activity, writes the results into the repo (`src/data/strava-activities.json` + `public/images/strava/*.png`), commits them, and triggers a Vercel deploy hook. An Astro component reads the committed JSON at build time to render the widget.

**Tech Stack:** TypeScript (run via `tsx`), Node.js `fetch`, Zod (schema validation), Vitest (tests), GitHub Actions (cron + `stefanzweifel/git-auto-commit-action`), Google Static Maps API, Strava API v3.

## Global Constraints

- Node.js >= 24 (matches `package.json` `engines`).
- No Python, no second language/runtime — everything in TypeScript, matching the rest of the project.
- Exactly 3 activities, newest first, fixed-length array — not configurable in this iteration.
- No Vercel Functions, Vercel Cron, or Vercel Blob — the site stays fully static (per ADR 0001); freshness comes from GitHub Actions cron + a triggered rebuild.
- `src/data/strava-activities.json` is always fully overwritten (not appended/merged) on each successful sync.
- `mapImage` is nullable — a failed Google Static Maps request for one activity must not fail the whole sync run.
- Strava/Google API calls are never unit-tested directly (no live network calls in CI); only the pure logic around them is tested.
- Secrets used by the workflow: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`, `GOOGLE_MAPS_API_KEY`, `VERCEL_DEPLOY_HOOK_URL` — provisioning them is a manual, out-of-scope step (documented, not automated).

---

## File Structure

```
scripts/strava-sync/
  types.ts        # raw Strava API response shape
  schema.ts        # ActivityRecord zod schema + inferred type (our stored shape)
  transform.ts      # StravaActivity -> ActivityRecord (minus mapImage)
  googleMaps.ts     # build a Google Static Maps URL from an encoded polyline
  diff.ts          # decide whether the fetched activities differ from what's stored
  env.ts           # requireEnv() helper for reading required secrets
  strava.ts        # network calls: refreshAccessToken, fetchLatestActivities
  index.ts         # orchestration entry point run by the workflow

scripts/strava-sync/*.test.ts   # one test file per pure module above (not strava.ts/index.ts)

src/data/strava-activities.json   # seeded as `[]`, overwritten by the workflow at runtime
src/components/StravaActivities.astro  # renders the 3 activity cards
src/pages/freizeit/sport/index.astro   # modified: use the new component instead of the old embed

.github/workflows/strava-sync.yml
README.md   # modified: document the 5 required secrets
```

---

### Task 1: Add `tsx` and `zod` as explicit dev dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `npx tsx <file>.ts` becomes available for running TypeScript directly; `zod` importable from any script (not just via the `astro:content` re-export).

- [ ] **Step 1: Install the packages**

Run: `npm install -D tsx zod`

- [ ] **Step 2: Verify they resolve**

Run: `npx tsx --version && node -e "require('zod')"`
Expected: prints a tsx version; the `node -e` call exits with no error.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tsx and zod for the Strava sync script"
```

---

### Task 2: Activity record schema (`schema.ts`)

**Files:**
- Create: `scripts/strava-sync/schema.ts`
- Test: `scripts/strava-sync/schema.test.ts`

**Interfaces:**
- Produces: `activityRecordSchema` (Zod schema), `ActivityRecord` (TS type inferred from it) — used by `transform.ts`, `index.ts`, and the Astro component.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/strava-sync/schema.test.ts
import { describe, expect, it } from 'vitest';
import { activityRecordSchema } from './schema';

describe('activityRecordSchema', () => {
	it('accepts a complete record with a map image', () => {
		const result = activityRecordSchema.safeParse({
			id: 123,
			name: 'Morning Ride',
			date: '2026-08-04T06:12:00Z',
			distanceKm: 42.3,
			avgSpeedKmh: 28.1,
			avgHeartRate: 142,
			movingTimeMinutes: 91,
			mapImage: '/images/strava/activity-123.png',
		});
		expect(result.success).toBe(true);
	});

	it('accepts a record with a null map image and null heart rate', () => {
		const result = activityRecordSchema.safeParse({
			id: 123,
			name: 'Morning Ride',
			date: '2026-08-04T06:12:00Z',
			distanceKm: 42.3,
			avgSpeedKmh: 28.1,
			avgHeartRate: null,
			movingTimeMinutes: 91,
			mapImage: null,
		});
		expect(result.success).toBe(true);
	});

	it('rejects a record missing required fields', () => {
		const result = activityRecordSchema.safeParse({
			id: 123,
			name: 'Morning Ride',
		});
		expect(result.success).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/strava-sync/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/strava-sync/schema.ts
import { z } from 'zod';

export const activityRecordSchema = z.object({
	id: z.number(),
	name: z.string(),
	date: z.string(),
	distanceKm: z.number(),
	avgSpeedKmh: z.number(),
	avgHeartRate: z.number().nullable(),
	movingTimeMinutes: z.number(),
	mapImage: z.string().nullable(),
});

export type ActivityRecord = z.infer<typeof activityRecordSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/strava-sync/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/strava-sync/schema.ts scripts/strava-sync/schema.test.ts
git commit -m "feat: add ActivityRecord schema for Strava sync"
```

---

### Task 3: Raw Strava type + transform to `ActivityRecord`

**Files:**
- Create: `scripts/strava-sync/types.ts`
- Create: `scripts/strava-sync/transform.ts`
- Test: `scripts/strava-sync/transform.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `StravaActivity` (raw API shape, used by `strava.ts` and `index.ts`); `toActivityRecord(activity: StravaActivity): Omit<ActivityRecord, 'mapImage'>` (used by `index.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// scripts/strava-sync/transform.test.ts
import { describe, expect, it } from 'vitest';
import { toActivityRecord } from './transform';
import type { StravaActivity } from './types';

const baseActivity: StravaActivity = {
	id: 123,
	name: 'Morning Ride',
	start_date: '2026-08-04T06:12:00Z',
	distance: 42300, // meters
	average_speed: 7.805555, // m/s
	average_heartrate: 142.4,
	moving_time: 5460, // seconds
	map: { summary_polyline: 'abc' },
};

describe('toActivityRecord', () => {
	it('converts meters/s to km and km/h, rounded to 1 decimal', () => {
		const result = toActivityRecord(baseActivity);
		expect(result.distanceKm).toBe(42.3);
		expect(result.avgSpeedKmh).toBe(28.1);
	});

	it('rounds heart rate and moving time to whole numbers', () => {
		const result = toActivityRecord(baseActivity);
		expect(result.avgHeartRate).toBe(142);
		expect(result.movingTimeMinutes).toBe(91);
	});

	it('returns null heart rate when Strava omits it', () => {
		const { average_heartrate, ...withoutHeartrate } = baseActivity;
		const result = toActivityRecord(withoutHeartrate as StravaActivity);
		expect(result.avgHeartRate).toBeNull();
	});

	it('carries over id, name, and date unchanged', () => {
		const result = toActivityRecord(baseActivity);
		expect(result.id).toBe(123);
		expect(result.name).toBe('Morning Ride');
		expect(result.date).toBe('2026-08-04T06:12:00Z');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/strava-sync/transform.test.ts`
Expected: FAIL — `Cannot find module './transform'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/strava-sync/types.ts
export interface StravaActivity {
	id: number;
	name: string;
	start_date: string;
	distance: number; // meters
	average_speed: number; // m/s
	average_heartrate?: number;
	moving_time: number; // seconds
	map?: { summary_polyline?: string };
}
```

```ts
// scripts/strava-sync/transform.ts
import type { ActivityRecord } from './schema';
import type { StravaActivity } from './types';

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

export function toActivityRecord(activity: StravaActivity): Omit<ActivityRecord, 'mapImage'> {
	return {
		id: activity.id,
		name: activity.name,
		date: activity.start_date,
		distanceKm: round1(activity.distance / 1000),
		avgSpeedKmh: round1(activity.average_speed * 3.6),
		avgHeartRate: activity.average_heartrate != null ? Math.round(activity.average_heartrate) : null,
		movingTimeMinutes: Math.round(activity.moving_time / 60),
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/strava-sync/transform.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/strava-sync/types.ts scripts/strava-sync/transform.ts scripts/strava-sync/transform.test.ts
git commit -m "feat: transform raw Strava activities into ActivityRecord"
```

---

### Task 4: Google Static Maps URL builder

**Files:**
- Create: `scripts/strava-sync/googleMaps.ts`
- Test: `scripts/strava-sync/googleMaps.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `buildStaticMapUrl(encodedPolyline: string, apiKey: string): string` — used by `index.ts`.

**Note:** Strava's `summary_polyline` is already encoded with the same Google Polyline Algorithm Format that Static Maps' `path=enc:` expects, so it's passed straight through — no decode/re-encode step.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/strava-sync/googleMaps.test.ts
import { describe, expect, it } from 'vitest';
import { buildStaticMapUrl } from './googleMaps';

describe('buildStaticMapUrl', () => {
	it('builds a Static Maps URL with the encoded polyline as a path', () => {
		const url = buildStaticMapUrl('abc~123', 'test-key');
		const parsed = new URL(url);
		expect(parsed.origin + parsed.pathname).toBe('https://maps.googleapis.com/maps/api/staticmap');
		expect(parsed.searchParams.get('key')).toBe('test-key');
		expect(parsed.searchParams.get('size')).toBe('600x400');
		expect(parsed.searchParams.get('path')).toContain('enc:abc~123');
	});

	it('URL-encodes special characters in the polyline', () => {
		const url = buildStaticMapUrl('a|b', 'test-key');
		const parsed = new URL(url);
		expect(parsed.searchParams.get('path')).toContain('enc:a|b');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/strava-sync/googleMaps.test.ts`
Expected: FAIL — `Cannot find module './googleMaps'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/strava-sync/googleMaps.ts
export function buildStaticMapUrl(encodedPolyline: string, apiKey: string): string {
	const params = new URLSearchParams({
		size: '600x400',
		path: `color:0x2563ebff|weight:4|enc:${encodedPolyline}`,
		key: apiKey,
	});
	return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/strava-sync/googleMaps.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/strava-sync/googleMaps.ts scripts/strava-sync/googleMaps.test.ts
git commit -m "feat: build Google Static Maps URLs from Strava polylines"
```

---

### Task 5: Change detection (`diff.ts`)

**Files:**
- Create: `scripts/strava-sync/diff.ts`
- Test: `scripts/strava-sync/diff.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `hasNewActivities(previous: { id: number }[], latest: { id: number }[]): boolean` — used by `index.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/strava-sync/diff.test.ts
import { describe, expect, it } from 'vitest';
import { hasNewActivities } from './diff';

describe('hasNewActivities', () => {
	it('returns false when the latest activities are the same set as before', () => {
		const previous = [{ id: 1 }, { id: 2 }, { id: 3 }];
		const latest = [{ id: 3 }, { id: 2 }, { id: 1 }];
		expect(hasNewActivities(previous, latest)).toBe(false);
	});

	it('returns true when at least one latest activity is not in the previous set', () => {
		const previous = [{ id: 1 }, { id: 2 }, { id: 3 }];
		const latest = [{ id: 4 }, { id: 2 }, { id: 1 }];
		expect(hasNewActivities(previous, latest)).toBe(true);
	});

	it('returns true when there was no previous data', () => {
		expect(hasNewActivities([], [{ id: 1 }])).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/strava-sync/diff.test.ts`
Expected: FAIL — `Cannot find module './diff'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/strava-sync/diff.ts
export function hasNewActivities(previous: { id: number }[], latest: { id: number }[]): boolean {
	const previousIds = new Set(previous.map((activity) => activity.id));
	return latest.some((activity) => !previousIds.has(activity.id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/strava-sync/diff.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/strava-sync/diff.ts scripts/strava-sync/diff.test.ts
git commit -m "feat: detect new Strava activities to skip no-op syncs"
```

---

### Task 6: Required-env helper (`env.ts`)

**Files:**
- Create: `scripts/strava-sync/env.ts`
- Test: `scripts/strava-sync/env.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `requireEnv(name: string): string` — used by `index.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/strava-sync/env.test.ts
import { describe, expect, it } from 'vitest';
import { requireEnv } from './env';

describe('requireEnv', () => {
	it('returns the value when the env var is set', () => {
		process.env.TEST_VAR_SET = 'hello';
		expect(requireEnv('TEST_VAR_SET')).toBe('hello');
		delete process.env.TEST_VAR_SET;
	});

	it('throws a descriptive error when the env var is missing', () => {
		delete process.env.TEST_VAR_MISSING;
		expect(() => requireEnv('TEST_VAR_MISSING')).toThrow('TEST_VAR_MISSING');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/strava-sync/env.test.ts`
Expected: FAIL — `Cannot find module './env'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/strava-sync/env.ts
export function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/strava-sync/env.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/strava-sync/env.ts scripts/strava-sync/env.test.ts
git commit -m "feat: add requireEnv helper for the Strava sync script"
```

---

### Task 7: Strava API client (`strava.ts`)

No unit test in this task — per Global Constraints, live network calls aren't tested in CI. The functions are kept thin and pure-ish (inputs in, HTTP call, typed output) so `index.ts` stays the only place that needs manual verification (via `workflow_dispatch`).

**Files:**
- Create: `scripts/strava-sync/strava.ts`

**Interfaces:**
- Consumes: `StravaActivity` type from `types.ts` (Task 3).
- Produces: `refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string>`; `fetchLatestActivities(accessToken: string, count: number): Promise<StravaActivity[]>` — both used by `index.ts`.

- [ ] **Step 1: Write the implementation**

```ts
// scripts/strava-sync/strava.ts
import type { StravaActivity } from './types';

export async function refreshAccessToken(
	clientId: string,
	clientSecret: string,
	refreshToken: string,
): Promise<string> {
	const response = await fetch('https://www.strava.com/oauth/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		}),
	});
	if (!response.ok) {
		throw new Error(`Strava token refresh failed: ${response.status} ${await response.text()}`);
	}
	const data = (await response.json()) as { access_token: string };
	return data.access_token;
}

export async function fetchLatestActivities(accessToken: string, count: number): Promise<StravaActivity[]> {
	const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${count}`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!response.ok) {
		throw new Error(`Strava activities fetch failed: ${response.status} ${await response.text()}`);
	}
	return (await response.json()) as StravaActivity[];
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: 0 errors (this file has no runtime test, but must typecheck cleanly).

- [ ] **Step 3: Commit**

```bash
git add scripts/strava-sync/strava.ts
git commit -m "feat: add Strava API client for token refresh and activity fetch"
```

---

### Task 8: Orchestration script (`index.ts`) + seed data file

**Files:**
- Create: `scripts/strava-sync/index.ts`
- Create: `src/data/strava-activities.json` (seeded as `[]`)

**Interfaces:**
- Consumes: `requireEnv` (Task 6), `refreshAccessToken`/`fetchLatestActivities` (Task 7), `buildStaticMapUrl` (Task 4), `toActivityRecord` (Task 3), `hasNewActivities` (Task 5), `activityRecordSchema`/`ActivityRecord` (Task 2).
- Produces: writes `src/data/strava-activities.json` and `public/images/strava/activity-<id>.png` as a side effect when run. No exported function consumed elsewhere — this is the CLI entry point invoked by the workflow (Task 9).

- [ ] **Step 1: Seed the data file so builds work before the first cron run**

```json
[]
```
Save as `src/data/strava-activities.json`.

- [ ] **Step 2: Write the orchestration script**

```ts
// scripts/strava-sync/index.ts
import fs from 'node:fs';
import path from 'node:path';
import { requireEnv } from './env';
import { refreshAccessToken, fetchLatestActivities } from './strava';
import { buildStaticMapUrl } from './googleMaps';
import { toActivityRecord } from './transform';
import { hasNewActivities } from './diff';
import { activityRecordSchema, type ActivityRecord } from './schema';

const ACTIVITY_COUNT = 3;
const DATA_PATH = path.resolve('src/data/strava-activities.json');
const IMAGES_DIR = path.resolve('public/images/strava');

async function main(): Promise<void> {
	const clientId = requireEnv('STRAVA_CLIENT_ID');
	const clientSecret = requireEnv('STRAVA_CLIENT_SECRET');
	const refreshToken = requireEnv('STRAVA_REFRESH_TOKEN');
	const mapsApiKey = requireEnv('GOOGLE_MAPS_API_KEY');

	const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
	const activities = await fetchLatestActivities(accessToken, ACTIVITY_COUNT);

	const previous: ActivityRecord[] = fs.existsSync(DATA_PATH)
		? JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
		: [];

	if (!hasNewActivities(previous, activities)) {
		console.log('No new activities since last sync, skipping.');
		return;
	}

	fs.mkdirSync(IMAGES_DIR, { recursive: true });

	const records: ActivityRecord[] = [];
	for (const activity of activities) {
		const base = toActivityRecord(activity);
		let mapImage: string | null = null;
		const polyline = activity.map?.summary_polyline;

		if (polyline) {
			try {
				const url = buildStaticMapUrl(polyline, mapsApiKey);
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`Google Static Maps request failed: ${response.status}`);
				}
				const buffer = Buffer.from(await response.arrayBuffer());
				const filename = `activity-${activity.id}.png`;
				fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);
				mapImage = `/images/strava/${filename}`;
			} catch (error) {
				console.warn(`Skipping map image for activity ${activity.id}:`, error);
			}
		}

		records.push(activityRecordSchema.parse({ ...base, mapImage }));
	}

	fs.writeFileSync(DATA_PATH, JSON.stringify(records, null, '\t') + '\n');
	console.log(`Wrote ${records.length} activities to ${DATA_PATH}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
```

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/strava-sync/index.ts src/data/strava-activities.json
git commit -m "feat: add Strava sync orchestration script"
```

---

### Task 9: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/strava-sync.yml`

**Interfaces:**
- Consumes: `scripts/strava-sync/index.ts` (Task 8) as the command it runs; reads the 4 API secrets plus `VERCEL_DEPLOY_HOOK_URL` from GitHub repo secrets.
- Produces: on a successful run with new activities, an updated `main` branch and a triggered Vercel deploy.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/strava-sync.yml
name: Strava Sync

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch: {}

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      - name: Fetch Strava activities and build map images
        env:
          STRAVA_CLIENT_ID: ${{ secrets.STRAVA_CLIENT_ID }}
          STRAVA_CLIENT_SECRET: ${{ secrets.STRAVA_CLIENT_SECRET }}
          STRAVA_REFRESH_TOKEN: ${{ secrets.STRAVA_REFRESH_TOKEN }}
          GOOGLE_MAPS_API_KEY: ${{ secrets.GOOGLE_MAPS_API_KEY }}
        run: npx tsx scripts/strava-sync/index.ts

      - name: Commit updated activity data
        id: commit
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: update Strava activity data'
          file_pattern: 'src/data/strava-activities.json public/images/strava/*.png'

      - name: Trigger Vercel deploy
        if: steps.commit.outputs.changes_detected == 'true'
        run: curl -fsS -X POST "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}"
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/strava-sync.yml'))" && echo OK`
Expected: prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/strava-sync.yml
git commit -m "ci: add scheduled Strava sync workflow"
```

---

### Task 10: Astro widget component + wire into Sport page

**Files:**
- Create: `src/components/StravaActivities.astro`
- Modify: `src/pages/freizeit/sport/index.astro` (replace the commented-out embed block, lines 49-61, with `<StravaActivities />`)

**Interfaces:**
- Consumes: `src/data/strava-activities.json` (Task 8), shaped per `ActivityRecord` (Task 2) — imported directly as a JSON module.
- Produces: nothing consumed by later tasks (leaf component).

- [ ] **Step 1: Write the component**

```astro
---
// src/components/StravaActivities.astro
import activities from '../data/strava-activities.json';

interface ActivityRecord {
	id: number;
	name: string;
	date: string;
	distanceKm: number;
	avgSpeedKmh: number;
	avgHeartRate: number | null;
	movingTimeMinutes: number;
	mapImage: string | null;
}

const records = activities as ActivityRecord[];
---

{records.length > 0 && (
	<section class="mt-8 grid gap-6 sm:grid-cols-3">
		{records.map((activity) => (
			<div class="rounded-lg border border-border p-4">
				{activity.mapImage && (
					<img
						src={activity.mapImage}
						alt={`Strecke: ${activity.name}`}
						class="mb-3 w-full rounded-md"
					/>
				)}
				<h3 class="font-heading font-semibold">{activity.name}</h3>
				<p class="text-sm text-muted-foreground">
					{new Date(activity.date).toLocaleDateString('de-DE')}
				</p>
				<ul class="mt-2 space-y-1 text-sm text-muted-foreground">
					<li>Distanz: {activity.distanceKm} km</li>
					<li>Ø Geschwindigkeit: {activity.avgSpeedKmh} km/h</li>
					{activity.avgHeartRate && <li>Ø Herzfrequenz: {activity.avgHeartRate} bpm</li>}
					<li>Dauer: {activity.movingTimeMinutes} min</li>
				</ul>
			</div>
		))}
	</section>
)}
```

- [ ] **Step 2: Wire it into the Sport page**

In `src/pages/freizeit/sport/index.astro`, add the import near the other component imports:

```astro
import StravaActivities from '../../../components/StravaActivities.astro';
```

Replace the commented-out block (current lines 49-61, the `<!-- ... Strava embed placeholder ... -->` section) with:

```astro
<StravaActivities />
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run check && npm run build`
Expected: 0 errors; build succeeds and includes the Sport page with an empty activities section (since the seed data is `[]`, the `{records.length > 0 && ...}` block renders nothing — verify no crash).

- [ ] **Step 4: Commit**

```bash
git add src/components/StravaActivities.astro src/pages/freizeit/sport/index.astro
git commit -m "feat: render Strava activities widget on the Sport page"
```

---

### Task 11: Document required secrets

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the 5 secret names introduced across Tasks 7-9 (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`, `GOOGLE_MAPS_API_KEY`, `VERCEL_DEPLOY_HOOK_URL`).
- Produces: nothing consumed by later tasks — documentation leaf.

- [ ] **Step 1: Add a section to `README.md`**

```markdown
## Strava activity sync

The Sport page shows the latest 3 Strava activities, kept fresh by a daily
GitHub Actions workflow (`.github/workflows/strava-sync.yml`). It requires
these repo secrets (Settings → Secrets and variables → Actions):

- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` — from your Strava API
  application (strava.com/settings/api).
- `STRAVA_REFRESH_TOKEN` — obtained once via Strava's OAuth authorization
  flow for that application.
- `GOOGLE_MAPS_API_KEY` — a Google Cloud API key scoped to the Maps Static
  API only, billing enabled.
- `VERCEL_DEPLOY_HOOK_URL` — from the Vercel project's Settings → Git →
  Deploy Hooks (needed because this project does not auto-deploy on push).

Trigger a run manually via the Actions tab ("Strava Sync" → "Run workflow")
to verify the secrets are correct before relying on the daily schedule.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document Strava sync required secrets"
```

---

### Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full check/test/build sequence**

Run: `npm run check && npm run test && npm run build`
Expected: typecheck 0 errors, all Vitest suites pass (schema, transform, googleMaps, diff, env, plus the pre-existing `content.config.test.ts`), build completes and includes the Sport page.

- [ ] **Step 2: Confirm the seeded empty state renders without error**

Run: `npx astro preview` (after `npm run build`), then check `http://localhost:4321/freizeit/sport` in a browser — the page should load normally with no Strava section visible (since `src/data/strava-activities.json` is still `[]` at this point; real data only appears after the workflow's secrets are configured and it runs for the first time).

- [ ] **Step 3: Note remaining manual steps for the user**

Not automatable by this plan — confirm with the user before considering the feature "done":
- Provision the 5 secrets listed in Task 11 in GitHub repo settings.
- Manually trigger the workflow once via `workflow_dispatch` and confirm `src/data/strava-activities.json` and `public/images/strava/*.png` get committed with real data, and the Vercel deploy hook fires.
