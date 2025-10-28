export type ProviderType = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'custom';

export interface ProviderConfig {
  type: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface ProviderOption {
  type: ProviderType;
  name: string;
  defaultModels: string[];
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
}

export const PROVIDERS: Record<ProviderType, ProviderOption> = {
  openai: {
    type: 'openai',
    name: 'OpenAI',
    defaultModels: [
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4o',
      'gpt-4o-mini',
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  anthropic: {
    type: 'anthropic',
    name: 'Anthropic',
    defaultModels: [
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-1-20250805',
      'Claude Haiku 3.5',
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  openrouter: {
    type: 'openrouter',
    name: 'OpenRouter',
    defaultModels: [
      'anthropic/claude-sonnet-4.5',
      'moonshotai/kimi-k2:free',
      'google/gemini-pro-1.5',
      'meta-llama/llama-3.1-70b-instruct',
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
  },
  ollama: {
    type: 'ollama',
    name: 'Ollama (Local)',
    defaultModels: [
      'gemma3:1b',
    ],
    requiresApiKey: false,
    requiresBaseUrl: true,
  },
  custom: {
    type: 'custom',
    name: 'Custom Provider',
    defaultModels: [],
    requiresApiKey: true,
    requiresBaseUrl: true,
  },
};

export function getProviderOption(type: ProviderType): ProviderOption {
  return PROVIDERS[type];
}

export function getProviderTypes(): ProviderType[] {
  return Object.keys(PROVIDERS) as ProviderType[];
}

export function getProviderNames(): string[] {
  return getProviderTypes().map(type => PROVIDERS[type].name);
}
