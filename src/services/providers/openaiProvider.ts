import type { Message, AIResponse } from '../aiProvider.js';
import type { ProviderConfig } from '../../config/providers.js';
import { AIError, AIErrorType } from '../errors.js';

interface OpenAIResponse {
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
    type?: string;
    code?: string;
  };
}

export async function sendToOpenAI(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
  isReasoningModel: boolean;
}): Promise<AIResponse> {
  const { config, apiKey, messages, isReasoningModel } = params;

  if (!apiKey) {
    throw AIError.missingApiKey('OpenAI');
  }

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        stream: false,
        ...(isReasoningModel && {
          reasoning_effort: 'medium',
          store: true
        })
      })
    });
  } catch (error) {
    throw AIError.fromNetworkError(error, 'OpenAI', config.model);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as OpenAIResponse;
    throw AIError.fromResponse(response, 'OpenAI', config.model, errorData);
  }

  const data = await response.json() as OpenAIResponse;
  const content = data.choices?.[0]?.message?.content || '';
  const reasoning = data.choices?.[0]?.message?.reasoning_content;

  if (!content && !reasoning) {
    throw new AIError({
      type: AIErrorType.API_ERROR,
      message: 'OpenAI returned empty response',
      provider: 'OpenAI',
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

export async function sendToOpenAIStream(params: {
  config: ProviderConfig;
  apiKey?: string;
  messages: Message[];
  isReasoningModel: boolean;
  onDelta: (delta: string) => void;
}): Promise<AIResponse> {
  const { onDelta, ...rest } = params;
  const response = await sendToOpenAI(rest);

  if (response.content) {
    onDelta(response.content);
  }

  return response;
}
