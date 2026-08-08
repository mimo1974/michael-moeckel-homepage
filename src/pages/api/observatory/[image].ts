import type { APIRoute } from 'astro';

export const prerender = false;

const IMAGE_CONTENT_TYPES: Record<string, string> = {
	'webcam1.jpg': 'image/jpeg',
	'sqmleg.gif': 'image/gif',
	'Capture.jpg': 'image/jpeg',
	'AAG_ImageCloudCondition.png': 'image/png',
    'AAG_ImageRainCondition.png': 'image/png',
	'dome.jpg': 'image/jpeg',
};

export const GET: APIRoute = async ({ params }) => {
	const filename = params.image;
	const contentType = filename ? IMAGE_CONTENT_TYPES[filename] : undefined;

	if (!filename || !contentType) {
		return new Response('Not found', { status: 404 });
	}

	const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const upstream = await fetch(`http://elsterland-sternwarte.de/images/${filename}?p=${cacheBuster}`);

	if (!upstream.ok) {
		return new Response('Upstream error', { status: 502 });
	}

	const body = await upstream.arrayBuffer();
	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'no-store',
		},
	});
};
