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
		avgWatts: activity.average_watts != null ? Math.round(activity.average_watts) : null,
		normalizedPower: activity.weighted_average_watts != null ? Math.round(activity.weighted_average_watts) : null,
		movingTimeMinutes: Math.round(activity.moving_time / 60),
	};
}
