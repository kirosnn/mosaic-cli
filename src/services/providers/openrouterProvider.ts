import type { Message, AIResponse } from '../aiProvider.js';
import type { ProviderConfig } from '../../config/providers.js';
import { AIError, AIErrorType } from '../errors.js';

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    code?: number;
  };
}

export async function sendToOpenRouter(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
  isReasoningModel: boolean;
}): Promise<AIResponse> {
  const { config, apiKey, messages } = params;

  if (!apiKey) {
    throw AIError.missingApiKey('OpenRouter');
  }

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/mosaic-cli',
        'X-Title': 'Mosaic CLI'
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages
      })
    });
  } catch (error) {
    throw AIError.fromNetworkError(error, 'OpenRouter', config.model);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as OpenRouterResponse;
    throw AIError.fromResponse(response, 'OpenRouter', config.model, errorData);
  }

  const data = await response.json() as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content || '';
  const reasoning = data.choices?.[0]?.message?.reasoning_content;

  if (!content && !reasoning) {
    throw new AIError({
      type: AIErrorType.API_ERROR,
      message: 'OpenRouter returned empty response',
      provider: 'OpenRouter',
      model: config.model,
      retryable: true
    });
  }

  return {
    content,
    reasoning,
    usage: data.usage
  };
}

export async function sendToOpenRouterStream(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
  isReasoningModel: boolean;
  onDelta: (delta: string) => void;
}): Promise<AIResponse> {
  const { onDelta, ...rest } = params;
  const response = await sendToOpenRouter(rest);

  if (response.content) {
    onDelta(response.content);
  }

  return response;
}
