# Astro + Tailwind + React (shadcn/ui) as the stack

Content is mostly static (bio, project highlights, hobby write-ups and log entries), so we chose Astro over a full framework like Next.js to avoid shipping unnecessary JS and backend complexity. We're layering Tailwind CSS and the React integration on top solely so shadcn/ui components can be used via React islands for the dark, techy UI — the rest of the site stays plain Astro/HTML.
