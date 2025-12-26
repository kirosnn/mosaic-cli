import { IDEType } from '../services/ideIntegration/types.js';

export interface IDEConfig {
  autoDetectOnStartup: boolean;
  preferredIDE?: IDEType;
  detectionCacheMs: number;
  enabledIDEs: IDEType[];
}

export const defaultIDEConfig: IDEConfig = {
  autoDetectOnStartup: false,
  detectionCacheMs: 5000,
  enabledIDEs: ['vscode', 'cursor', 'windsurf']
};
