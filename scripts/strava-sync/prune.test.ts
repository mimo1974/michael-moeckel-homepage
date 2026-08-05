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

	it('returns an empty array when there are no existing files', () => {
		expect(findStaleImages([], ['/images/strava/activity-1.png'])).toEqual([]);
	});

	it('treats every existing file as stale when there are no current image paths', () => {
		const existingFiles = ['activity-1.png', 'activity-2.png'];
		expect(findStaleImages(existingFiles, [])).toEqual(existingFiles);
	});

	it('treats every existing file as stale when all current image paths are null', () => {
		const existingFiles = ['activity-1.png', 'activity-2.png'];
		expect(findStaleImages(existingFiles, [null, null])).toEqual(existingFiles);
	});

	it('preserves the original order of existing files for multiple stale entries', () => {
		const existingFiles = ['activity-1.png', 'activity-2.png', 'activity-3.png', 'activity-4.png'];
		const currentImagePaths = ['/images/strava/activity-2.png'];
		expect(findStaleImages(existingFiles, currentImagePaths)).toEqual([
			'activity-1.png',
			'activity-3.png',
			'activity-4.png',
		]);
	});

	it('deduplicates current image paths that reference the same filename', () => {
		const existingFiles = ['activity-1.png', 'activity-2.png'];
		const currentImagePaths = ['/images/strava/activity-1.png', '/images/strava/activity-1.png'];
		expect(findStaleImages(existingFiles, currentImagePaths)).toEqual(['activity-2.png']);
	});

	it('matches filenames regardless of the directory prefix in current image paths', () => {
		const existingFiles = ['activity-1.png'];
		const currentImagePaths = ['/some/other/nested/path/activity-1.png'];
		expect(findStaleImages(existingFiles, currentImagePaths)).toEqual([]);
	});

	it('is case-sensitive when comparing filenames', () => {
		const existingFiles = ['Activity-1.png'];
		const currentImagePaths = ['/images/strava/activity-1.png'];
		expect(findStaleImages(existingFiles, currentImagePaths)).toEqual(['Activity-1.png']);
	});
});
