import { defineConfig } from 'vite';
import oreheartServiceWorker from './tools/sw-plugin.mjs'; // Nov 2: writes dist/sw.js (the offline app) after every build
export default defineConfig({ base: './', plugins: [oreheartServiceWorker()], build: { chunkSizeWarningLimit: 1500 }, test: { include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup-dice.ts'] } });
