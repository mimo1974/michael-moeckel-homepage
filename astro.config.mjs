// @ts-check
import fs from 'node:fs';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    server: {
      https: {
        cert: fs.readFileSync('./localhost+2.pem'),
        key: fs.readFileSync('./localhost+2-key.pem'),
      },
    },
  },

  integrations: [react()]
});