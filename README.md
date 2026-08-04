# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Strava activity sync

The Sport page shows the latest 3 Strava activities, kept fresh by a daily
GitHub Actions workflow (`.github/workflows/strava-sync.yml`). It requires
these repo secrets (Settings → Secrets and variables → Actions):

- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` — from your Strava API
  application (strava.com/settings/api).
- `STRAVA_REFRESH_TOKEN` — obtained once via Strava's OAuth authorization
  flow for that application.
- `GOOGLE_MAPS_API_KEY` — a Google Cloud API key scoped to the Maps Static
  API only, billing enabled.
- `VERCEL_DEPLOY_HOOK_URL` — from the Vercel project's Settings → Git →
  Deploy Hooks (needed because this project does not auto-deploy on push).

Trigger a run manually via the Actions tab ("Strava Sync" → "Run workflow")
to verify the secrets are correct before relying on the daily schedule.
