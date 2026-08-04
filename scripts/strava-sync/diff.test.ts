import { describe, expect, it } from 'vitest';
import { hasNewActivities } from './diff';

describe('hasNewActivities', () => {
	it('returns false when the latest activities are the same set as before', () => {
		const previous = [{ id: 1 }, { id: 2 }, { id: 3 }];
		const latest = [{ id: 3 }, { id: 2 }, { id: 1 }];
		expect(hasNewActivities(previous, latest)).toBe(false);
	});

	it('returns true when at least one latest activity is not in the previous set', () => {
		const previous = [{ id: 1 }, { id: 2 }, { id: 3 }];
		const latest = [{ id: 4 }, { id: 2 }, { id: 1 }];
		expect(hasNewActivities(previous, latest)).toBe(true);
	});

	it('returns true when there was no previous data', () => {
		expect(hasNewActivities([], [{ id: 1 }])).toBe(true);
	});
});
