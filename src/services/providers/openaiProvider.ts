import type { Message, AIResponse } from '../aiProvider.js';
import type { ProviderConfig } from '../../config/providers.js';
import { AIError, AIErrorType } from '../errors.js';

type OpenAIEndpoint = 'responses' | 'chat';

interface OpenAIErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

interface OpenAIUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: OpenAIUsage;
}

interface OpenAIResponsesResponse {
  output_text?: string;
  output?: Array<{
    reasoning?: {
      content?: string;
    };
  }>;
  usage?: OpenAIUsage;
}

type OpenAIResponseData = OpenAIChatResponse | OpenAIResponsesResponse;

const CHAT_MODELS = new Set([
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4-turbo'
]);

function resolveEndpoint(model: string): OpenAIEndpoint {
  return CHAT_MODELS.has(model) ? 'chat' : 'responses';
}

function normalizeMessages(messages: Message[]) {
  return messages.map(m => ({
    role: m.role,
    content: m.content
  }));
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

  const endpoint = resolveEndpoint(config.model);
  const url =
    endpoint === 'chat'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.openai.com/v1/responses';

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(
        endpoint === 'chat'
          ? {
              model: config.model,
              messages: normalizeMessages(messages),
              stream: false
            }
          : {
              model: config.model,
              input: normalizeMessages(messages),
              ...(isReasoningModel && {
                reasoning: { effort: 'medium' }
              })
            }
      )
    });
  } catch (error) {
    throw AIError.fromNetworkError(error, 'OpenAI', config.model);
  }

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as OpenAIErrorPayload;

    if (
      response.status === 404 &&
      errorData.error?.message?.includes('not a chat model')
    ) {
      throw new AIError({
        type: AIErrorType.CONFIG_ERROR,
        message: `Model ${config.model} does not support chat/completions`,
        provider: 'OpenAI',
        model: config.model,
        retryable: false
      });
    }

    throw AIError.fromResponse(response, 'OpenAI', config.model, errorData);
  }

  const data = (await response.json()) as OpenAIResponseData;

  let content = '';
  let reasoning: string | undefined;
  const usage = data.usage;

  if (endpoint === 'chat') {
    content =
      (data as OpenAIChatResponse).choices?.[0]?.message?.content ?? '';
  } else {
    const output = (data as OpenAIResponsesResponse).output_text ?? '';
    content = typeof output === 'string' ? output : '';
    reasoning =
      (data as OpenAIResponsesResponse).output?.[0]?.reasoning?.content;
  }

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
    usage
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