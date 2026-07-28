import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const logEntrySchema = z.object({
	date: z.coerce.date(),
	title: z.string(),
	tags: z.array(z.string()).optional(),
	photos: z.array(z.string()).optional(),
});

const astronomie = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/astronomie' }),
	schema: logEntrySchema,
});

const sport = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/sport' }),
	schema: logEntrySchema,
});

export const collections = { astronomie, sport };
