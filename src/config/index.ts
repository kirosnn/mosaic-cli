export { MOSAIC_DIR, CONFIG_FILE, ensureMosaicDir } from './paths.js';
export {
  loadConfig,
  saveConfig,
  updateConfig,
  getConfigValue,
  setConfigValue,
  addToModelHistory,
  getModelHistory,
  type MosaicConfig,
  type ModelHistoryItem,
  type SavedProvider,
} from './manager.js';
export { getPackageVersion } from './version.js';
export { themes, getTheme, getThemeNames, type Theme } from './themes.js';
export { getMissingConfigs, isConfigComplete } from './validator.js';