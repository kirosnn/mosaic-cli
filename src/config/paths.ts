import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export const MOSAIC_DIR = join(homedir(), '.mosaic');
export const CONFIG_FILE = join(MOSAIC_DIR, 'config.json');

export function ensureMosaicDir(): void {
  if (!existsSync(MOSAIC_DIR)) {
    mkdirSync(MOSAIC_DIR, { recursive: true });
  }
}
