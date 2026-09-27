import { defineConfig } from 'vite';

// GitHub Pages serves project sites from /<repo>/; the workflow passes that in.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
});
