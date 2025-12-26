import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { homedir, platform, hostname } from 'os';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

function getMachineId(): string {
  const hostnameValue = hostname();
  const user = homedir();
  const platformInfo = platform();

  return `${hostnameValue}-${user}-${platformInfo}`;
}

function deriveKey(salt: Buffer): Buffer {
  const machineId = getMachineId();
  return scryptSync(machineId, salt, KEY_LENGTH);
}

export function encrypt(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  const result = Buffer.concat([
    salt,
    iv,
    tag,
    Buffer.from(encrypted, 'hex')
  ]);

  return result.toString('base64');
}

export function decrypt(encryptedData: string): string {
  const buffer = Buffer.from(encryptedData, 'base64');

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = deriveKey(salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function isEncrypted(data: string): boolean {
  try {
    const buffer = Buffer.from(data, 'base64');
    return buffer.length > SALT_LENGTH + IV_LENGTH + TAG_LENGTH;
  } catch {
    return false;
  }
}