import { readFileSync } from 'node:fs';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const https = {
  cert: readFileSync('.certs/dev.pem'),
  key: readFileSync('.certs/dev-key.pem'),
};

// Playwright starts its own server on another port (PORT env), see playwright.config.ts.
const port = Number(process.env['PORT'] ?? 5173);

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: { https, host: true, port, strictPort: true },
  preview: { https, host: true, port, strictPort: true },
});
