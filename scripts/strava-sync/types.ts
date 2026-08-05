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
