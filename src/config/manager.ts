import { readFileSync, writeFileSync, existsSync } from 'fs';
import { CONFIG_FILE, ensureMosaicDir } from './paths.js';
import { getPackageVersion } from './version.js';
import { ProviderType } from './providers.js';
import { verboseLogger } from '../utils/VerboseLogger.js';

export interface SavedProvider {
  name: string;
  type: ProviderType;
  model: string;
  baseUrl?: string;
}

export interface ModelHistoryItem {
  providerType: ProviderType;
  model: string;
  lastUsed: number;
}

export interface MosaicConfig {
  version?: string;
  theme?: string;
  language?: string;
  provider?: {
    type: ProviderType;
    model: string;
    baseUrl?: string;
  };
  savedProviders?: SavedProvider[];
  modelHistory?: ModelHistoryItem[];
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
    const details = error instanceof Error ? error.stack || error.message : String(error);
    verboseLogger.logMessage(`Error reading config file, using defaults: ${details}`, 'error');
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: MosaicConfig): void {
  ensureMosaicDir();

  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    const details = error instanceof Error ? error.stack || error.message : String(error);
    verboseLogger.logMessage(`Error saving config file: ${details}`, 'error');
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

export function addToModelHistory(providerType: ProviderType, model: string): void {
  const config = loadConfig();
  const history = config.modelHistory || [];

  const existingIndex = history.findIndex(
    item => item.providerType === providerType && item.model === model
  );

  if (existingIndex !== -1) {
    history[existingIndex].lastUsed = Date.now();
  } else {
    history.push({
      providerType,
      model,
      lastUsed: Date.now()
    });
  }

  history.sort((a, b) => b.lastUsed - a.lastUsed);

  const maxHistorySize = 20;
  if (history.length > maxHistorySize) {
    history.splice(maxHistorySize);
  }

  updateConfig({ modelHistory: history });
}

export function getModelHistory(): ModelHistoryItem[] {
  const config = loadConfig();
  return config.modelHistory || [];
}