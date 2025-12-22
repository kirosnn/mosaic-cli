import { ProviderType, ProviderConfig, isReasoningModel } from '../config/providers.js';
import { getSecret } from '../config/secrets.js';
import { loadSystemPrompt } from '../config/systemPrompt.js';
import { AIError, AIErrorType } from './errors.js';
import { RetryHandler, DEFAULT_RETRY_CONFIG } from './retryHandler.js';
import { OllamaClient } from './ollamaClient.js';
import { getModelDataFromFallback } from '../utils/modelsFetcher.js';

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

export class AIProvider {
  private config: ProviderConfig;
  private apiKey?: string;
  private systemPrompt: string;
  private retryHandler: RetryHandler;
  private ollamaClient?: OllamaClient;
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
    this.isReasoningModel = isReasoningModel(config.type, config.model);

    if (config.type === 'mistral') {
      const modelData = getModelDataFromFallback('mistralai', config.model);
      const contextLimit = modelData?.limit?.context;
      const outputLimit = modelData?.limit?.output;

      this.MAX_TOKENS = typeof contextLimit === 'number' && contextLimit > 0
        ? contextLimit
        : 16384;

      this.maxCompletionTokens = typeof outputLimit === 'number' && outputLimit > 0
        ? outputLimit
        : undefined;
    } else {
      this.MAX_TOKENS = 16384;
      this.maxCompletionTokens = undefined;
    }

    if (config.type === 'ollama') {
      this.ollamaClient = new OllamaClient(config.baseUrl || 'http://localhost:11434');
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.TOKEN_RATIO);
  }

  private truncateMessages(messages: Message[], maxTokens: number): Message[] {
    const systemMessage = messages.find(msg => msg.role === 'system');
    const otherMessages = messages.filter(msg => msg.role !== 'system');

    let totalTokens = systemMessage ? this.estimateTokens(systemMessage.content) : 0;
    const keptMessages: Message[] = [];

    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateTokens(otherMessages[i].content);

      if (totalTokens + msgTokens > maxTokens) {
        break;
      }

      totalTokens += msgTokens;
      keptMessages.unshift(otherMessages[i]);
    }

    if (systemMessage) {
      return [systemMessage, ...keptMessages];
    }

    return keptMessages;
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
            return await this.sendToOpenAI(preparedMessages);
          case 'anthropic':
            return await this.sendToAnthropic(preparedMessages);
          case 'openrouter':
            return await this.sendToOpenRouter(preparedMessages);
          case 'ollama':
            return await this.sendToOllama(preparedMessages);
          case 'xai':
            return await this.sendToXAI(preparedMessages);
          case 'mistral':
            return await this.sendToMistral(preparedMessages);
          case 'custom':
            return await this.sendToCustom(preparedMessages);
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
      const response = await this.sendMessage(messages);

      if (response.content) {
        onDelta(response.content);
      }

      return response;
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

  private async sendToOpenAI(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      throw AIError.missingApiKey('OpenAI');
    }

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          stream: false,
          ...(this.isReasoningModel && {
            reasoning_effort: 'medium',
            store: true
          })
        })
      });
    } catch (error) {
      throw AIError.fromNetworkError(error, 'OpenAI', this.config.model);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as OpenAIResponse;
      throw AIError.fromResponse(response, 'OpenAI', this.config.model, errorData);
    }

    const data = await response.json() as OpenAIResponse;
    const content = data.choices?.[0]?.message?.content || '';
    const reasoning = data.choices?.[0]?.message?.reasoning_content;

    if (!content && !reasoning) {
      throw new AIError({
        type: AIErrorType.API_ERROR,
        message: 'OpenAI returned empty response',
        provider: 'OpenAI',
        model: this.config.model,
        retryable: false
      });
    }

    return {
      content,
      reasoning,
      usage: data.usage
    };
  }

  private async sendToAnthropic(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
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
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.MAX_TOKENS,
          system: systemMessages.length > 0 ? systemMessages[0].content : undefined,
          messages: conversationMessages,
          ...(this.isReasoningModel && {
            thinking: {
              type: 'enabled',
              budget_tokens: 10000
            }
          })
        })
      });
    } catch (error) {
      throw AIError.fromNetworkError(error, 'Anthropic', this.config.model);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as AnthropicResponse;
      throw AIError.fromResponse(response, 'Anthropic', this.config.model, errorData);
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
        model: this.config.model,
        retryable: false
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

  private async sendToOpenRouter(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      throw AIError.missingApiKey('OpenRouter');
    }

    let response: Response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/mosaic-cli',
          'X-Title': 'Mosaic CLI'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages
        })
      });
    } catch (error) {
      throw AIError.fromNetworkError(error, 'OpenRouter', this.config.model);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as OpenRouterResponse;
      throw AIError.fromResponse(response, 'OpenRouter', this.config.model, errorData);
    }

    const data = await response.json() as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content || '';
    const reasoning = data.choices?.[0]?.message?.reasoning_content;

    if (!content && !reasoning) {
      throw new AIError({
        type: AIErrorType.API_ERROR,
        message: 'OpenRouter returned empty response',
        provider: 'OpenRouter',
        model: this.config.model,
        retryable: false
      });
    }

    return {
      content,
      reasoning,
      usage: data.usage
    };
  }

  private async sendToOllama(messages: Message[]): Promise<AIResponse> {
    if (!this.ollamaClient) {
      throw AIError.missingBaseUrl('Ollama');
    }

    try {
      const response = await this.ollamaClient.chat(this.config.model, messages, true);
      let content = response.message?.content || '';
      let reasoning: string | undefined;

      if (this.isReasoningModel && content) {
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
          model: this.config.model,
          retryable: false
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
      throw AIError.fromNetworkError(error, 'Ollama', this.config.model);
    }
  }

  private async sendToXAI(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      throw AIError.missingApiKey('xAI');
    }

    let response: Response;
    try {
      response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          stream: false
        })
      });
    } catch (error) {
      throw AIError.fromNetworkError(error, 'xAI', this.config.model);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as XAIResponse;
      throw AIError.fromResponse(response, 'xAI', this.config.model, errorData);
    }

    const data = await response.json() as XAIResponse;
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new AIError({
        type: AIErrorType.API_ERROR,
        message: 'xAI returned empty response',
        provider: 'xAI',
        model: this.config.model,
        retryable: false
      });
    }

    return {
      content,
      usage: data.usage
    };
  }

  private async sendToMistral(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      throw AIError.missingApiKey('Mistral');
    }

    let response: Response;
    try {
      response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          stream: false,
          ...(this.maxCompletionTokens && { max_tokens: this.maxCompletionTokens })
        })
      });
    } catch (error) {
      throw AIError.fromNetworkError(error, 'Mistral', this.config.model);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as MistralResponse;
      throw AIError.fromResponse(response, 'Mistral', this.config.model, errorData);
    }

    const data = await response.json() as MistralResponse;
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new AIError({
        type: AIErrorType.API_ERROR,
        message: 'Mistral returned empty response',
        provider: 'Mistral',
        model: this.config.model,
        retryable: false
      });
    }

    return {
      content,
      usage: data.usage
    };
  }

  private async sendToCustom(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      throw AIError.missingApiKey('Custom provider');
    }

    if (!this.config.baseUrl) {
      throw AIError.missingBaseUrl('Custom provider');
    }

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          stream: false
        })
      });
    } catch (error) {
      throw AIError.fromNetworkError(error, 'Custom provider', this.config.model);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as CustomResponse;
      throw AIError.fromResponse(response, 'Custom provider', this.config.model, errorData);
    }

    const data = await response.json() as CustomResponse;
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new AIError({
        type: AIErrorType.API_ERROR,
        message: 'Custom provider returned empty response',
        provider: 'Custom provider',
        model: this.config.model,
        retryable: false
      });
    }

    return { content };
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