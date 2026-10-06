import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://getflexspace.com',
  integrations: [sitemap({ filter: page => !new URL(page).pathname.startsWith('/admin/') })],
  vite: {
    plugins: [tailwindcss()],
  },
});
