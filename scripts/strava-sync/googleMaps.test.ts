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
