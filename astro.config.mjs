// @ts-check
import fs from 'node:fs';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

const certPath = './localhost+2.pem';
const keyPath = './localhost+2-key.pem';
const hasLocalCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

// https://astro.build/config
export default defineConfig({
  site: 'https://michael-moeckel.de',

  vite: {
    plugins: [tailwindcss()],
    server: {
      https: hasLocalCerts
        ? {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
          }
        : undefined,
    },
  },

  integrations: [react(), sitemap()],
  adapter: vercel(),
});