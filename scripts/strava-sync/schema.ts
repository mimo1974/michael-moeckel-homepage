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
