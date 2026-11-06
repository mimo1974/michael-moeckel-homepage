import type { APIRoute } from 'astro';

export const prerender = false;

// Ignore link-preview bots from mail clients, Slack, LinkedIn etc.
const BOT_PATTERN = /bot|preview|crawler|spider|facebookexternalhit|slack|linkedin|whatsapp/i;

export const GET: APIRoute = async ({ request }) => {
	const ua = request.headers.get('user-agent') ?? '';
	const country = request.headers.get('x-vercel-ip-country') ?? '?';
	const city = decodeURIComponent(request.headers.get('x-vercel-ip-city') ?? '?');
	const topic = process.env.NTFY_TOPIC;

	if (!BOT_PATTERN.test(ua) && topic) {
		try {
			await fetch(`https://ntfy.sh/${topic}`, {
				method: 'POST',
				body: `Video opened – ${city}, ${country}\n${ua}`,
			});
		} catch (error) {
			console.error('application_track: ntfy notification failed', error);
		}
	}

	return new Response(null, { status: 302, headers: { Location: '/application.mp4' } });
};
