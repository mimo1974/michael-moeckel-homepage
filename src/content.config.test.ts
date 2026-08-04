import { describe, expect, it } from 'vitest';
import { logEntrySchema } from './content.config';

describe('logEntrySchema', () => {
	it('accepts a minimal valid entry', () => {
		const result = logEntrySchema.safeParse({
			date: '2026-01-15',
			title: 'Testeintrag',
		});
		expect(result.success).toBe(true);
	});

	it('accepts optional tags and photos', () => {
		const result = logEntrySchema.safeParse({
			date: '2026-01-15',
			title: 'Testeintrag',
			tags: ['astro', 'saturn'],
			photos: ['saturn.jpg'],
		});
		expect(result.success).toBe(true);
	});

	it('coerces date strings into Date objects', () => {
		const result = logEntrySchema.safeParse({
			date: '2026-01-15',
			title: 'Testeintrag',
		});
		expect(result.success && result.data.date).toBeInstanceOf(Date);
	});

	it('rejects an entry missing the required title', () => {
		const result = logEntrySchema.safeParse({
			date: '2026-01-15',
		});
		expect(result.success).toBe(false);
	});

	it('rejects an entry with an invalid date', () => {
		const result = logEntrySchema.safeParse({
			date: 'not-a-date',
			title: 'Testeintrag',
		});
		expect(result.success).toBe(false);
	});
});
