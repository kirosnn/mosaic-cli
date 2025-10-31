export type ProviderType = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'xai' | 'mistral' | 'custom';

export interface ModelCapabilities {
  supportsStreaming: boolean;
  supportsReasoning: boolean;
  supportsVision: boolean;
  maxTokens: number;
  contextWindow: number;
}

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
  supportsReasoning: boolean;
  reasoningModels: string[];
}

export const PROVIDERS: Record<ProviderType, ProviderOption> = {
  openai: {
    type: 'openai',
    name: 'OpenAI',
    defaultModels: [
      'o3-mini',
      'o1',
      'o1-mini',
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
    supportsReasoning: true,
    reasoningModels: ['o3-mini', 'o1', 'o1-mini', 'o1-preview']
  },
  anthropic: {
    type: 'anthropic',
    name: 'Anthropic',
    defaultModels: [
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-1-20250805',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsReasoning: true,
    reasoningModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-1-20250805']
  },
  openrouter: {
    type: 'openrouter',
    name: 'OpenRouter',
    defaultModels: [
      'anthropic/claude-sonnet-4.5',
      'openai/o1-mini',
      'openai/o1',
      'google/gemini-2.0-flash-thinking-exp',
      'deepseek/deepseek-r1',
      'moonshotai/kimi-k2:free',
      'google/gemini-pro-1.5',
      'meta-llama/llama-3.1-70b-instruct',
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsReasoning: true,
    reasoningModels: [
      'openai/o1',
      'openai/o1-mini',
      'openai/o3-mini',
      'google/gemini-2.0-flash-thinking-exp',
      'deepseek/deepseek-r1'
    ]
  },
  xai: {
    type: 'xai',
    name: 'xAI',
    defaultModels: [
      'grok-beta',
      'grok-vision-beta',
      'grok-2-latest',
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsReasoning: false,
    reasoningModels: []
  },
  mistral: {
    type: 'mistral',
    name: 'Mistral AI',
    defaultModels: [
      'mistral-large-latest',
      'mistral-medium-latest',
      'mistral-small-latest',
      'codestral-latest',
      'mistral-embed',
    ],
    requiresApiKey: true,
    requiresBaseUrl: false,
    supportsReasoning: false,
    reasoningModels: []
  },
  ollama: {
    type: 'ollama',
    name: 'Ollama (Local)',
    defaultModels: [
      'deepseek-r1:1.5b',
      'deepseek-r1:3b',
      'deepseek-r1:7b',
      'deepseek-r1:8b',
      'deepseek-r1:14b',
      'deepseek-r1:32b',
      'deepseek-r1:70b',
      'qwen2.5:0.5b',
      'qwen2.5:3b',
      'qwen2.5:7b',
      'llama3.2:1b',
      'llama3.2:3b',
      'gemma2:2b',
    ],
    requiresApiKey: false,
    requiresBaseUrl: true,
    supportsReasoning: true,
    reasoningModels: [
      'deepseek-r1:1.5b',
      'deepseek-r1:3b',
      'deepseek-r1:7b',
      'deepseek-r1:8b',
      'deepseek-r1:14b',
      'deepseek-r1:32b',
      'deepseek-r1:70b'
    ]
  },
  custom: {
    type: 'custom',
    name: 'Custom Provider',
    defaultModels: [],
    requiresApiKey: true,
    requiresBaseUrl: true,
    supportsReasoning: false,
    reasoningModels: []
  },
};

export function isReasoningModel(provider: ProviderType, model: string): boolean {
  const providerOption = PROVIDERS[provider];
  if (!providerOption.supportsReasoning) {
    return false;
  }

  return providerOption.reasoningModels.some(reasoningModel =>
    model.toLowerCase().includes(reasoningModel.toLowerCase()) ||
    reasoningModel.toLowerCase().includes(model.toLowerCase())
  );
}

export function getProviderOption(type: ProviderType): ProviderOption {
  return PROVIDERS[type];
}

export function getProviderTypes(): ProviderType[] {
  return Object.keys(PROVIDERS) as ProviderType[];
}

export function getProviderNames(): string[] {
  return getProviderTypes().map(type => PROVIDERS[type].name);
}

export function getModelCapabilities(provider: ProviderType, model: string): Partial<ModelCapabilities> {
  const isReasoning = isReasoningModel(provider, model);

  return {
    supportsStreaming: true,
    supportsReasoning: isReasoning,
    supportsVision: model.toLowerCase().includes('vision') || model.toLowerCase().includes('grok'),
  };
}
