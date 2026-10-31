import { defineConfig } from 'vite';
// No source maps in the build: the admin site's code is public anyway, but there is no need to hand out a map.
export default defineConfig({ base: '/', build: { sourcemap: false } });
