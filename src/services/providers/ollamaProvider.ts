import type { Message, AIResponse } from '../aiProvider.js';
import type { ProviderConfig } from '../../config/providers.js';
import type { OllamaClient } from '../ollamaClient.js';
import { AIError, AIErrorType } from '../errors.js';

export async function sendToOllama(params: {
  config: ProviderConfig;
  ollamaClient?: OllamaClient;
  messages: Message[];
  isReasoningModel: boolean;
}): Promise<AIResponse> {
  const { config, ollamaClient, messages, isReasoningModel } = params;

  if (!ollamaClient) {
    throw AIError.missingBaseUrl('Ollama');
  }

  try {
    const response = await ollamaClient.chat(config.model, messages, true);

    let content = response.message?.content || '';
    let reasoning: string | undefined;

    if (isReasoningModel && content) {
      const thinkingBlockRegex = /<think>[\s\S]*?<\/think>/g;
      const thinkingBlocks = content.match(thinkingBlockRegex);

      if (thinkingBlocks) {
        reasoning = thinkingBlocks.map((block: string) =>
          block.replace(/<\/?think>/g, '').trim()
        ).join('\n\n');

        content = content.replace(thinkingBlockRegex, '').trim();
      }
    }

    if (!content && !reasoning) {
      throw new AIError({
        type: AIErrorType.API_ERROR,
        message: 'Ollama returned empty response',
        provider: 'Ollama',
        model: config.model,
        retryable: true
      });
    }

    return {
      content,
      reasoning
    };
  } catch (error) {
    if (error instanceof AIError) {
      throw error;
    }
    throw AIError.fromNetworkError(error, 'Ollama', config.model);
  }
}

export async function sendToOllamaStream(params: {
  config: ProviderConfig;
  ollamaClient?: OllamaClient;
  messages: Message[];
  isReasoningModel: boolean;
  onDelta: (delta: string) => void;
}): Promise<AIResponse> {
  const { onDelta, ...rest } = params;
  const response = await sendToOllama(rest);

  if (response.content) {
    onDelta(response.content);
  }

  return response;
}
