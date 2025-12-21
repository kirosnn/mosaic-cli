import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProviderType } from '../config/providers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ModelData {
  id: string;
  name: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  knowledge?: string;
  modalities?: {
    input?: string[];
    output?: string[];
  };
  open_weights?: boolean;
  cost?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache_read?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
}

export interface ProviderData {
  id: string;
  env?: string;
  npm?: string;
  api?: string;
  name?: string;
  doc?: string;
  models: Record<string, ModelData>;
}

export type ModelsAPIResponse = Record<string, ProviderData>;

const MODELS_API_URL = 'https://models.dev/api.json';
const FALLBACK_FILE_PATH = path.join(__dirname, '../../src/config/modelsFallback.json');

const PROVIDER_MAPPING: Record<string, ProviderType> = {
  'openai': 'openai',
  'anthropic': 'anthropic',
  'openrouter': 'openrouter',
  'ollama-cloud': 'ollama',
  'xai': 'xai',
  'mistralai': 'mistral',
};

export async function fetchModelsFromAPI(): Promise<ModelsAPIResponse> {
  try {
    const response = await fetch(MODELS_API_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    return await response.json() as ModelsAPIResponse;
  } catch (error) {
    console.error('Error fetching models from API:', error);
    return loadFallbackModels();
  }
}

export function loadFallbackModels(): ModelsAPIResponse {
  try {
    const fallbackData = fs.readFileSync(FALLBACK_FILE_PATH, 'utf-8');
    return JSON.parse(fallbackData) as ModelsAPIResponse;
  } catch (error) {
    console.error('Error loading fallback models:', error);
    return {};
  }
}

export async function getLatestModelsForProvider(
  providerKey: string,
  limit: number = 10
): Promise<string[]> {
  const data = await fetchModelsFromAPI();
  const providerData = data[providerKey];

  if (!providerData || !providerData.models) {
    return [];
  }

  const models = Object.values(providerData.models);

  const sortedModels = models.sort((a, b) => {
    const dateA = a.knowledge || '0000-00';
    const dateB = b.knowledge || '0000-00';
    return dateB.localeCompare(dateA);
  });

  return sortedModels.slice(0, limit).map(model => model.id);
}

export interface ProviderModelsResult {
  defaultModels: string[];
  reasoningModels: string[];
}

export async function getAllProvidersLatestModels(limit: number = 10): Promise<Record<ProviderType, ProviderModelsResult>> {
  const data = await fetchModelsFromAPI();
  const result: Partial<Record<ProviderType, ProviderModelsResult>> = {};

  for (const [apiProviderKey, providerType] of Object.entries(PROVIDER_MAPPING)) {
    const providerData = data[apiProviderKey];
    if (!providerData || !providerData.models) {
      continue;
    }

    const models = Object.values(providerData.models);

    const sortedModels = models.sort((a, b) => {
      const dateA = a.knowledge || '0000-00';
      const dateB = b.knowledge || '0000-00';
      return dateB.localeCompare(dateA);
    });

    const topModels = sortedModels.slice(0, limit);
    const reasoningModels = topModels.filter(model => isReasoningModelData(model));

    result[providerType] = {
      defaultModels: topModels.map(model => model.id),
      reasoningModels: reasoningModels.map(model => model.id),
    };
  }

  return result as Record<ProviderType, ProviderModelsResult>;
}

export function isVisionModel(model: ModelData): boolean {
  if (model.attachment) return true;
  if (model.modalities?.input?.includes('image')) return true;
  if (model.modalities?.input?.includes('video')) return true;
  if (model.id.toLowerCase().includes('vision')) return true;
  return false;
}

export function isReasoningModelData(model: ModelData): boolean {
  if (model.reasoning) return true;
  const reasoningKeywords = ['o1', 'o3', 'thinking', 'reasoning', 'r1'];
  return reasoningKeywords.some(keyword => model.id.toLowerCase().includes(keyword));
}

export function getModelDataFromFallback(
  providerKey: string,
  modelId: string
): ModelData | null {
  const data = loadFallbackModels();
  const providerData = data[providerKey];

  if (!providerData || !providerData.models) {
    return null;
  }

  const model = providerData.models[modelId];
  return model || null;
}

export async function getModelCapabilitiesFromAPI(
  providerKey: string,
  modelId: string
): Promise<{ supportsVision: boolean; supportsReasoning: boolean } | null> {
  const data = await fetchModelsFromAPI();
  const providerData = data[providerKey];

  if (!providerData || !providerData.models) {
    return null;
  }

  const model = providerData.models[modelId];
  if (!model) {
    return null;
  }

  return {
    supportsVision: isVisionModel(model),
    supportsReasoning: isReasoningModelData(model),
  };
}