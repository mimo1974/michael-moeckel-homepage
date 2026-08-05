import { describe, expect, it } from 'vitest';
import { findStaleImages } from './prune';

describe('findStaleImages', () => {
	it('returns files not referenced by any current activity image', () => {
		const existingFiles = ['activity-1.png', 'activity-2.png', 'activity-3.png'];
		const currentImagePaths = ['/images/strava/activity-2.png', '/images/strava/activity-3.png'];
		expect(findStaleImages(existingFiles, currentImagePaths)).toEqual(['activity-1.png']);
	});

	it('returns an empty array when all files are still referenced', () => {
		const existingFiles = ['activity-1.png', 'activity-2.png'];
		const currentImagePaths = ['/images/strava/activity-1.png', '/images/strava/activity-2.png'];
		expect(findStaleImages(existingFiles, currentImagePaths)).toEqual([]);
	});

	it('ignores null image paths', () => {
		const existingFiles = ['activity-1.png'];
		const currentImagePaths = [null, '/images/strava/activity-1.png'];
		expect(findStaleImages(existingFiles, currentImagePaths)).toEqual([]);
	});
});
