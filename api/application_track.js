export default async function handler(req, res) {
    const ua = req.headers['user-agent'] || '';
    const country = req.headers['x-vercel-ip-country'] || '?';
    const city = decodeURIComponent(req.headers['x-vercel-ip-city'] || '?');

    // Ignore link-preview bots from mail clients, Slack, LinkedIn etc.
    const isBot = /bot|preview|crawler|spider|facebookexternalhit|slack|linkedin|whatsapp/i.test(ua);

    if (!isBot) {
        await fetch('https://ntfy.sh/' + process.env.NTFY_TOPIC, {
            method: 'POST',
            body: `Video opened – ${city}, ${country}\n${ua}`,
        }).catch(() => {});
    }

    res.redirect(302, '/application.mp4');
}