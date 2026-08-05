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
			avgWatts: 188,
			normalizedPower: 201,
			movingTimeMinutes: 91,
			mapImage: '/images/strava/activity-123.png',
		});
		expect(result.success).toBe(true);
	});

	it('accepts a record with a null map image, heart rate, and power fields', () => {
		const result = activityRecordSchema.safeParse({
			id: 123,
			name: 'Morning Ride',
			date: '2026-08-04T06:12:00Z',
			distanceKm: 42.3,
			avgSpeedKmh: 28.1,
			avgHeartRate: null,
			avgWatts: null,
			normalizedPower: null,
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
