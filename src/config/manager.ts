import { readFileSync, writeFileSync, existsSync } from 'fs';
import { CONFIG_FILE, ensureMosaicDir } from './paths.js';
import { getPackageVersion } from './version.js';
import { ProviderType } from './providers.js';

export interface MosaicConfig {
  version?: string;
  theme?: string;
  language?: string;
  provider?: {
    type: ProviderType;
    model: string;
    baseUrl?: string;
  };
  [key: string]: any;
}

const DEFAULT_CONFIG: MosaicConfig = {
  version: getPackageVersion(),
};

export function loadConfig(): MosaicConfig {
  ensureMosaicDir();

  if (!existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  try {
    const data = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading config file, using defaults:', error);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: MosaicConfig): void {
  ensureMosaicDir();

  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving config file:', error);
    throw error;
  }
}

export function updateConfig(updates: Partial<MosaicConfig>): MosaicConfig {
  const currentConfig = loadConfig();
  const newConfig = { ...currentConfig, ...updates };
  saveConfig(newConfig);
  return newConfig;
}

export function getConfigValue<K extends keyof MosaicConfig>(key: K): MosaicConfig[K] {
  const config = loadConfig();
  return config[key];
}

export function setConfigValue<K extends keyof MosaicConfig>(key: K, value: MosaicConfig[K]): void {
  updateConfig({ [key]: value });
}
