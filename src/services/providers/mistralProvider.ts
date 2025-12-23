import type { Message, AIResponse } from '../aiProvider.js';
import type { ProviderConfig } from '../../config/providers.js';
import { AIError, AIErrorType } from '../errors.js';

interface MistralResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

export async function sendToMistral(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
  maxCompletionTokens?: number;
}): Promise<AIResponse> {
  const { config, apiKey, messages, maxCompletionTokens } = params;

  if (!apiKey) {
    throw AIError.missingApiKey('Mistral');
  }

  let response: Response;
  try {
    response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        stream: false,
        ...(maxCompletionTokens && { max_tokens: maxCompletionTokens })
      })
    });
  } catch (error) {
    throw AIError.fromNetworkError(error, 'Mistral', config.model);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as MistralResponse;
    throw AIError.fromResponse(response, 'Mistral', config.model, errorData);
  }

  const data = await response.json() as MistralResponse;
  const content = data.choices?.[0]?.message?.content || '';

  if (!content) {
    throw new AIError({
      type: AIErrorType.API_ERROR,
      message: 'Mistral returned empty response',
      provider: 'Mistral',
      model: config.model,
      retryable: true
    });
  }

  return {
    content,
    usage: data.usage
  };
}

export async function sendToMistralStream(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
  maxCompletionTokens?: number;
  onDelta: (delta: string) => void;
}): Promise<AIResponse> {
  const { onDelta, ...rest } = params;
  const response = await sendToMistral(rest);

  if (response.content) {
    onDelta(response.content);
  }

  return response;
}
