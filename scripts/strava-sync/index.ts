import fs from 'node:fs';
import path from 'node:path';
import { requireEnv } from './env';
import { refreshAccessToken, fetchLatestActivities } from './strava';
import { buildStaticMapUrl } from './googleMaps';
import { toActivityRecord } from './transform';
import { hasNewActivities } from './diff';
import { findStaleImages } from './prune';
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

	const existingFiles = fs.readdirSync(IMAGES_DIR);
	const staleFiles = findStaleImages(
		existingFiles,
		records.map((record) => record.mapImage),
	);
	for (const file of staleFiles) {
		fs.unlinkSync(path.join(IMAGES_DIR, file));
	}
	if (staleFiles.length > 0) {
		console.log(`Removed ${staleFiles.length} stale image(s): ${staleFiles.join(', ')}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
