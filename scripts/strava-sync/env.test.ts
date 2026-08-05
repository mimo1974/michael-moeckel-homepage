import { describe, expect, it } from 'vitest';
import { requireEnv } from './env';

describe('requireEnv', () => {
	it('returns the value when the env var is set', () => {
		process.env.TEST_VAR_SET = 'hello';
		expect(requireEnv('TEST_VAR_SET')).toBe('hello');
		delete process.env.TEST_VAR_SET;
	});

	it('throws a descriptive error when the env var is missing', () => {
		delete process.env.TEST_VAR_MISSING;
		expect(() => requireEnv('TEST_VAR_MISSING')).toThrow('TEST_VAR_MISSING');
	});
});
