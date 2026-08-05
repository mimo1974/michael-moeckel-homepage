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
	average_watts: 187.6,
	weighted_average_watts: 201,
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

	it('rounds average watts and normalized power to whole numbers', () => {
		const result = toActivityRecord(baseActivity);
		expect(result.avgWatts).toBe(188);
		expect(result.normalizedPower).toBe(201);
	});

	it('returns null heart rate when Strava omits it', () => {
		const { average_heartrate, ...withoutHeartrate } = baseActivity;
		const result = toActivityRecord(withoutHeartrate as StravaActivity);
		expect(result.avgHeartRate).toBeNull();
	});

	it('returns null watts and normalized power for non-cycling activities', () => {
		const { average_watts, weighted_average_watts, ...withoutWatts } = baseActivity;
		const result = toActivityRecord(withoutWatts as StravaActivity);
		expect(result.avgWatts).toBeNull();
		expect(result.normalizedPower).toBeNull();
	});

	it('carries over id, name, and date unchanged', () => {
		const result = toActivityRecord(baseActivity);
		expect(result.id).toBe(123);
		expect(result.name).toBe('Morning Ride');
		expect(result.date).toBe('2026-08-04T06:12:00Z');
	});
});
