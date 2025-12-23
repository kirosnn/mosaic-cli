import { ProviderType, ProviderConfig, isReasoningModel } from '../config/providers.js';
import { getSecret } from '../config/secrets.js';
import { loadSystemPrompt } from '../config/systemPrompt.js';
import { AIError, AIErrorType } from './errors.js';
import { RetryHandler, DEFAULT_RETRY_CONFIG } from './retryHandler.js';
import { OllamaClient } from './ollamaClient.js';
import { getModelDataFromFallback } from '../utils/modelsFetcher.js';
import { sendToOpenAI, sendToOpenAIStream } from './providers/openaiProvider.js';
import { sendToAnthropic, sendToAnthropicStream } from './providers/anthropicProvider.js';
import { sendToOpenRouter, sendToOpenRouterStream } from './providers/openrouterProvider.js';
import { sendToOllama, sendToOllamaStream } from './providers/ollamaProvider.js';
import { sendToXAI, sendToXAIStream } from './providers/xaiProvider.js';
import { sendToMistral, sendToMistralStream } from './providers/mistralProvider.js';
import { sendToCustom, sendToCustomStream } from './providers/customProvider.js';
import { ConversationCompactor } from './conversationCompactor.js';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  error?: string;
  reasoning?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class AIProvider {
  private config: ProviderConfig;
  private apiKey?: string;
  private systemPrompt: string;

  private retryHandler: RetryHandler;
  private ollamaClient?: OllamaClient;
  private conversationCompactor: ConversationCompactor;
  private readonly MAX_TOKENS: number;
  private readonly TOKEN_RATIO = 4;
  private readonly isReasoningModel: boolean;
  private readonly maxCompletionTokens?: number;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.apiKey = getSecret(`${config.type}_api_key`);
    this.systemPrompt = loadSystemPrompt();

    this.retryHandler = new RetryHandler({
      ...DEFAULT_RETRY_CONFIG,
      maxRetries: 3,
      timeoutMs: 180000
    });
    this.conversationCompactor = new ConversationCompactor();
    this.isReasoningModel = isReasoningModel(config.type, config.model);

    const providerToApiKey: Record<ProviderType, string> = {
      'openai': 'openai',
      'anthropic': 'anthropic',
      'openrouter': 'openrouter',
      'ollama': 'ollama-cloud',
      'xai': 'xai',
      'mistral': 'mistralai',
      'custom': ''
    };

    const apiKey = providerToApiKey[config.type];
    const modelData = apiKey ? getModelDataFromFallback(apiKey, config.model) : null;
    const contextLimit = modelData?.limit?.context;
    const outputLimit = modelData?.limit?.output;

    const defaultLimits: Record<ProviderType, { context: number; output: number }> = {
      'openai': { context: 128000, output: 16384 },
      'anthropic': { context: 200000, output: 8192 },
      'openrouter': { context: 128000, output: 16384 },
      'ollama': { context: 200000, output: 8192 },
      'xai': { context: 131072, output: 8192 },
      'mistral': { context: 32768, output: 8192 },
      'custom': { context: 128000, output: 8192 }
    };

    const defaultLimit = defaultLimits[config.type];

    this.MAX_TOKENS = typeof contextLimit === 'number' && contextLimit > 0
      ? contextLimit
      : defaultLimit.context;

    this.maxCompletionTokens = typeof outputLimit === 'number' && outputLimit > 0
      ? outputLimit
      : defaultLimit.output;

    if (config.type === 'ollama') {
      const baseUrl = config.baseUrl || 'http://localhost:11434';
      this.ollamaClient = new OllamaClient(baseUrl, this.apiKey);
    }
  }

  private estimateTokens(text: string): number {
    if (!text || text.length === 0) return 0;

    let ratio = this.TOKEN_RATIO;

    const codePatterns = /```[\s\S]*?```|`[^`]+`|[{}\[\]();]|function|const|let|var|if|else|return/;
    const hasCode = codePatterns.test(text);

    const jsonPattern = /^\s*[\[{][\s\S]*[\]}]\s*$/;
    const isJson = jsonPattern.test(text);

    const hasMultibyteChars = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(text);

    if (isJson) {
      ratio = 3;
    } else if (hasCode) {
      ratio = 3.2;
    } else if (hasMultibyteChars) {
      ratio = 2;
    } else {
      ratio = 3.5;
    }

    const estimatedTokens = Math.ceil(text.length / ratio);

    return Math.ceil(estimatedTokens * 1.1);
  }

  private truncateMessages(messages: Message[], maxTokens: number): Message[] {
    const percentageReserved = Math.ceil(maxTokens * (this.isReasoningModel ? 0.4 : 0.3));
    const minReserved = 8192;

    const reservedForResponse = this.maxCompletionTokens
      ? Math.max(this.maxCompletionTokens, minReserved)
      : Math.max(percentageReserved, minReserved);

    let totalTokensBeforeCompaction = 0;
    for (const msg of messages) {
      totalTokensBeforeCompaction += this.estimateTokens(msg.content);
    }

    const effectiveLimit = maxTokens - reservedForResponse;
    const usagePercentage = (totalTokensBeforeCompaction / effectiveLimit) * 100;

    if (usagePercentage > 90) {
      console.warn(`[AIProvider] Token usage at ${usagePercentage.toFixed(1)}% of limit - applying automatic compaction`);
    } else if (usagePercentage > 70) {
      console.log(`[AIProvider] Token usage at ${usagePercentage.toFixed(1)}% - conversation may be compacted soon`);
    }

    return this.conversationCompactor.smartTruncate(
      messages,
      maxTokens,
      reservedForResponse
    );
  }

  private prepareMessages(messages: Message[]): Message[] {
    const hasSystemMessage = messages.some(msg => msg.role === 'system');

    let preparedMessages: Message[];
    if (hasSystemMessage) {
      preparedMessages = messages;
    } else {
      preparedMessages = [
        { role: 'system', content: this.systemPrompt },
        ...messages
      ];
    }

    return this.truncateMessages(preparedMessages, this.MAX_TOKENS);
  }

  async sendMessage(messages: Message[]): Promise<AIResponse> {
    try {
      const preparedMessages = this.prepareMessages(messages);

      return await this.retryHandler.executeWithRetry(async () => {
        switch (this.config.type) {
          case 'openai':
            return await sendToOpenAI({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages,
              isReasoningModel: this.isReasoningModel
            });
          case 'anthropic':
            return await sendToAnthropic({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages,
              isReasoningModel: this.isReasoningModel,
              maxTokens: this.MAX_TOKENS
            });
          case 'openrouter':
            return await sendToOpenRouter({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages,
              isReasoningModel: this.isReasoningModel
            });
          case 'ollama':
            return await sendToOllama({
              config: this.config,
              ollamaClient: this.ollamaClient,
              messages: preparedMessages,
              isReasoningModel: this.isReasoningModel
            });
          case 'xai':
            return await sendToXAI({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages
            });
          case 'mistral':
            return await sendToMistral({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages,
              maxCompletionTokens: this.maxCompletionTokens
            });
          case 'custom':
            return await sendToCustom({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages
            });
          default:
            throw new AIError({
              type: AIErrorType.UNKNOWN_ERROR,
              message: `Unknown provider type: ${this.config.type}`,
              provider: this.config.type,
              retryable: false
            });
        }
      }, `${this.config.type}_sendMessage`);
    } catch (error) {
      if (error instanceof AIError) {
        return { content: '', error: error.message };
      }
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async sendMessageStream(messages: Message[], onDelta: (delta: string) => void): Promise<AIResponse> {
    try {
      const preparedMessages = this.prepareMessages(messages);

      return await this.retryHandler.executeWithRetry(async () => {
        switch (this.config.type) {
          case 'openai':
            return await sendToOpenAIStream({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages,
              isReasoningModel: this.isReasoningModel,
              onDelta
            });
          case 'anthropic':
            return await sendToAnthropicStream({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages,
              isReasoningModel: this.isReasoningModel,
              maxTokens: this.MAX_TOKENS,
              onDelta
            });
          case 'openrouter':
            return await sendToOpenRouterStream({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages,
              isReasoningModel: this.isReasoningModel,
              onDelta
            });
          case 'ollama':
            return await sendToOllamaStream({
              config: this.config,
              ollamaClient: this.ollamaClient,
              messages: preparedMessages,
              isReasoningModel: this.isReasoningModel,
              onDelta
            });
          case 'xai':
            return await sendToXAIStream({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages,
              onDelta
            });
          case 'mistral':
            return await sendToMistralStream({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages,
              maxCompletionTokens: this.maxCompletionTokens,
              onDelta
            });
          case 'custom':
            return await sendToCustomStream({
              config: this.config,
              apiKey: this.apiKey,
              messages: preparedMessages,
              onDelta
            });
          default:
            throw new AIError({
              type: AIErrorType.UNKNOWN_ERROR,
              message: `Unknown provider type: ${this.config.type}`,
              provider: this.config.type,
              retryable: false
            });
        }
      }, `${this.config.type}_sendMessageStream`);
    } catch (error) {
      if (error instanceof AIError) {
        return { content: '', error: error.message };
      }
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  public getConfig(): ProviderConfig {
    return this.config;
  }

  public isUsingReasoningModel(): boolean {
    return this.isReasoningModel;
  }

  public getOllamaClient(): OllamaClient | undefined {
    return this.ollamaClient;
  }
}