import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { MOSAIC_DIR, ensureMosaicDir } from './paths.js';
import { encrypt, decrypt, isEncrypted } from './encryption.js';
import { verboseLogger } from '../utils/VerboseLogger.js';

const SECRETS_FILE = join(MOSAIC_DIR, '.secrets.json');

export interface Secrets {
  [key: string]: string;
}

function loadSecrets(): Secrets {
  ensureMosaicDir();

  if (!existsSync(SECRETS_FILE)) {
    return {};
  }

  try {
    const data = readFileSync(SECRETS_FILE, 'utf-8');

    let decryptedData: string;
    if (isEncrypted(data)) {
      try {
        decryptedData = decrypt(data);
      } catch (decryptError) {
        const details = decryptError instanceof Error ? decryptError.stack || decryptError.message : String(decryptError);
        verboseLogger.logMessage(`Error decrypting secrets file: ${details}`, 'error');
        return {};
      }
    } else {
      decryptedData = data;
    }

    return JSON.parse(decryptedData);
  } catch (error) {
    const details = error instanceof Error ? error.stack || error.message : String(error);
    verboseLogger.logMessage(`Error reading secrets file: ${details}`, 'error');
    return {};
  }
}

function saveSecrets(secrets: Secrets): void {
  ensureMosaicDir();

  try {
    const jsonData = JSON.stringify(secrets, null, 2);
    const encryptedData = encrypt(jsonData);
    writeFileSync(SECRETS_FILE, encryptedData, 'utf-8');
  } catch (error) {
    const details = error instanceof Error ? error.stack || error.message : String(error);
    verboseLogger.logMessage(`Error saving secrets file: ${details}`, 'error');
    throw error;
  }
}

export function setSecret(key: string, value: string): void {
  const secrets = loadSecrets();
  secrets[key] = value;
  saveSecrets(secrets);
}

export function getSecret(key: string): string | undefined {
  const secrets = loadSecrets();
  return secrets[key];
}

export function deleteSecret(key: string): void {
  const secrets = loadSecrets();
  delete secrets[key];
  saveSecrets(secrets);
}

export function hasSecret(key: string): boolean {
  const secrets = loadSecrets();
  return key in secrets && secrets[key] !== '';
}