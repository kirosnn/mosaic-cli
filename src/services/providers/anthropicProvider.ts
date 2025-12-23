import type { Message, AIResponse } from '../aiProvider.js';
import type { ProviderConfig } from '../../config/providers.js';
import { AIError, AIErrorType } from '../errors.js';

interface AnthropicResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
  };
}

export async function sendToAnthropic(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
  isReasoningModel: boolean;
  maxTokens: number;
}): Promise<AIResponse> {
  const { config, apiKey, messages, isReasoningModel, maxTokens } = params;

  if (!apiKey) {
    throw AIError.missingApiKey('Anthropic');
  }

  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        system: systemMessages.length > 0 ? systemMessages[0].content : undefined,
        messages: conversationMessages,
        ...(isReasoningModel && {
          thinking: {
            type: 'enabled',
            budget_tokens: 10000
          }
        })
      })
    });
  } catch (error) {
    throw AIError.fromNetworkError(error, 'Anthropic', config.model);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as AnthropicResponse;
    throw AIError.fromResponse(response, 'Anthropic', config.model, errorData);
  }

  const data = await response.json() as AnthropicResponse;

  let content = '';
  let reasoning = '';

  if (data.content) {
    for (const block of data.content) {
      if (block.type === 'thinking' && block.text) {
        reasoning += block.text;
      } else if (block.text) {
        content += block.text;
      }
    }
  }

  if (!content && !reasoning) {
    throw new AIError({
      type: AIErrorType.API_ERROR,
      message: 'Anthropic returned empty response',
      provider: 'Anthropic',
      model: config.model,
      retryable: true
    });
  }

  return {
    content,
    reasoning: reasoning || undefined,
    usage: data.usage ? {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens,
      total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
    } : undefined
  };
}

export async function sendToAnthropicStream(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
  isReasoningModel: boolean;
  maxTokens: number;
  onDelta: (delta: string) => void;
}): Promise<AIResponse> {
  const { onDelta, ...rest } = params;
  const response = await sendToAnthropic(rest);

  if (response.content) {
    onDelta(response.content);
  }

  return response;
}
