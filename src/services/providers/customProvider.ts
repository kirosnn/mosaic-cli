import type { Message, AIResponse } from '../aiProvider.js';
import type { ProviderConfig } from '../../config/providers.js';
import { AIError, AIErrorType } from '../errors.js';

interface CustomResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export async function sendToCustom(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
}): Promise<AIResponse> {
  const { config, apiKey, messages } = params;

  if (!apiKey) {
    throw AIError.missingApiKey('Custom provider');
  }

  if (!config.baseUrl) {
    throw AIError.missingBaseUrl('Custom provider');
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
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
    throw AIError.fromNetworkError(error, 'Custom provider', config.model);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as CustomResponse;
    throw AIError.fromResponse(response, 'Custom provider', config.model, errorData);
  }

  const data = await response.json() as CustomResponse;
  const content = data.choices?.[0]?.message?.content || '';

  if (!content) {
    throw new AIError({
      type: AIErrorType.API_ERROR,
      message: 'Custom provider returned empty response',
      provider: 'Custom provider',
      model: config.model,
      retryable: true
    });
  }

  return { content };
}

export async function sendToCustomStream(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
  onDelta: (delta: string) => void;
}): Promise<AIResponse> {
  const { onDelta, ...rest } = params;
  const response = await sendToCustom(rest);

  if (response.content) {
    onDelta(response.content);
  }

  return response;
}
