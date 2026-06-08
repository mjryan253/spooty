import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

/** Repo root (spooty/), from src/backend/test */
const repoRoot = resolve(__dirname, '../../..');

process.env.DB_PATH = resolve(repoRoot, 'dist/backend-e2e.sqlite');
process.env.FE_PATH = resolve(repoRoot, 'dist/frontend/browser');
process.env.DOWNLOADS_PATH = resolve(repoRoot, 'dist/e2e-downloads');
process.env.FORMAT = 'mp3';

for (const dir of [
  resolve(repoRoot, 'dist'),
  process.env.DOWNLOADS_PATH!,
  resolve(repoRoot, 'dist/frontend/browser'),
]) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
