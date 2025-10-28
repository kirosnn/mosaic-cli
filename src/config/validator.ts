import { MosaicConfig } from './manager.js';

const REQUIRED_CONFIGS = ['theme', 'provider'];

export function getMissingConfigs(config: MosaicConfig): string[] {
  const missing: string[] = [];

  for (const key of REQUIRED_CONFIGS) {
    if (!config[key]) {
      missing.push(key);
    }
  }

  if (config.provider && !config.provider.type) {
    missing.push('provider');
  }

  if (config.provider && !config.provider.model) {
    missing.push('provider');
  }

  return missing;
}

export function isConfigComplete(config: MosaicConfig): boolean {
  return getMissingConfigs(config).length === 0;
}
