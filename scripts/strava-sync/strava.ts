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
