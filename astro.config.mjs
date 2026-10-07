import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://getflexspace.com',
  redirects: { '/retail-space/': '/locations/morganton-nc/', '/about/': '/locations/' },
  integrations: [sitemap({ filter: page => !new URL(page).pathname.startsWith('/admin/') && new URL(page).pathname !== '/about/' })],
  vite: {
    plugins: [tailwindcss()],
  },
});
