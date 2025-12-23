import type { Message, AIResponse } from '../aiProvider.js';
import type { ProviderConfig } from '../../config/providers.js';
import { AIError, AIErrorType } from '../errors.js';

interface XAIResponse {
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

export async function sendToXAI(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
}): Promise<AIResponse> {
  const { config, apiKey, messages } = params;

  if (!apiKey) {
    throw AIError.missingApiKey('xAI');
  }

  let response: Response;
  try {
    response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        stream: false
      })
    });
  } catch (error) {
    throw AIError.fromNetworkError(error, 'xAI', config.model);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as XAIResponse;
    throw AIError.fromResponse(response, 'xAI', config.model, errorData);
  }

  const data = await response.json() as XAIResponse;
  const content = data.choices?.[0]?.message?.content || '';

  if (!content) {
    throw new AIError({
      type: AIErrorType.API_ERROR,
      message: 'xAI returned empty response',
      provider: 'xAI',
      model: config.model,
      retryable: true
    });
  }

  return {
    content,
    usage: data.usage
  };
}

export async function sendToXAIStream(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
  onDelta: (delta: string) => void;
}): Promise<AIResponse> {
  const { onDelta, ...rest } = params;
  const response = await sendToXAI(rest);

  if (response.content) {
    onDelta(response.content);
  }

  return response;
}
