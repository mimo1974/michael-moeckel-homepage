export function buildStaticMapUrl(encodedPolyline: string, apiKey: string): string {
	const params = new URLSearchParams({
		size: '600x400',
		path: `color:0x2563ebff|weight:4|enc:${encodedPolyline}`,
		key: apiKey,
	});
	return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}
