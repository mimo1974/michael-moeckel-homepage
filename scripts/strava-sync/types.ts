export interface StravaActivity {
	id: number;
	name: string;
	start_date: string;
	distance: number; // meters
	average_speed: number; // m/s
	average_heartrate?: number;
	average_watts?: number;
	weighted_average_watts?: number;
	moving_time: number; // seconds
	map?: { summary_polyline?: string };
}
