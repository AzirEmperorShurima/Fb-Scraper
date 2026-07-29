import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(__dirname, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Cập nhật client_id từ biến môi trường
if (manifest.oauth2) {
  manifest.oauth2.client_id = process.env.OAUTH2_CLIENTID || '';
}

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
