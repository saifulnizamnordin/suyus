// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Custom domain (public/CNAME) serves the site from the root, so no `base` is needed.
  site: 'https://suy.us',
  // Pages are built as p/<username>.html, which GitHub Pages serves at /p/<username> (no trailing slash).
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [react()],

  markdown: {
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    },
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
