import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { verboseLogger } from '../utils/VerboseLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getPackageVersion(): string {
  try {
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || '0.0.5.00';
  } catch (error) {
    const details = error instanceof Error ? error.stack || error.message : String(error);
    verboseLogger.logMessage(`Error reading package.json version: ${details}`, 'error');
    return '0.0.5.00';
  }
}