import { ProviderType, ProviderConfig } from '../config/providers.js';
import { getSecret } from '../config/secrets.js';
import { loadSystemPrompt } from '../config/systemPrompt.js';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  error?: string;
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface AnthropicResponse {
  content?: Array<{
    text?: string;
  }>;
  error?: {
    message?: string;
  };
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface OllamaResponse {
  message?: {
    content?: string;
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

  constructor(config: ProviderConfig) {
    this.config = config;
    this.apiKey = getSecret(`${config.type}_api_key`);
    this.systemPrompt = loadSystemPrompt();
  }

  private prepareMessages(messages: Message[]): Message[] {
    const hasSystemMessage = messages.some(msg => msg.role === 'system');

    if (hasSystemMessage) {
      return messages;
    }

    return [
      { role: 'system', content: this.systemPrompt },
      ...messages
    ];
  }

  async sendMessage(messages: Message[]): Promise<AIResponse> {
    try {
      const preparedMessages = this.prepareMessages(messages);

      switch (this.config.type) {
        case 'openai':
          return await this.sendToOpenAI(preparedMessages);
        case 'anthropic':
          return await this.sendToAnthropic(preparedMessages);
        case 'openrouter':
          return await this.sendToOpenRouter(preparedMessages);
        case 'ollama':
          return await this.sendToOllama(preparedMessages);
        case 'custom':
          return await this.sendToCustom(preparedMessages);
        default:
          return { content: '', error: 'Unknown provider type' };
      }
    } catch (error) {
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async sendToOpenAI(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      return { content: '', error: 'OpenAI API key not found' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as OpenAIResponse;
      return {
        content: '',
        error: `OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }

    const data = await response.json() as OpenAIResponse;
    return {
      content: data.choices?.[0]?.message?.content || 'No response from OpenAI'
    };
  }

  private async sendToAnthropic(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      return { content: '', error: 'Anthropic API key not found' };
    }

    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 4096,
        system: systemMessages.length > 0 ? systemMessages[0].content : undefined,
        messages: conversationMessages
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as AnthropicResponse;
      return {
        content: '',
        error: `Anthropic API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }

    const data = await response.json() as AnthropicResponse;
    return {
      content: data.content?.[0]?.text || 'No response from Anthropic'
    };
  }

  private async sendToOpenRouter(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      return { content: '', error: 'OpenRouter API key not found' };
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as OpenRouterResponse;
      return {
        content: '',
        error: `OpenRouter API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }

    const data = await response.json() as OpenRouterResponse;
    return {
      content: data.choices?.[0]?.message?.content || 'No response from OpenRouter'
    };
  }

  private async sendToOllama(messages: Message[]): Promise<AIResponse> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        stream: false
      })
    });

    if (!response.ok) {
      return {
        content: '',
        error: `Ollama API error: ${response.status} - ${response.statusText}`
      };
    }

    const data = await response.json() as OllamaResponse;
    return {
      content: data.message?.content || 'No response from Ollama'
    };
  }

  private async sendToCustom(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      return { content: '', error: 'Custom provider API key not found' };
    }

    if (!this.config.baseUrl) {
      return { content: '', error: 'Custom provider base URL not configured' };
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as CustomResponse;
      return {
        content: '',
        error: `Custom provider error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }

    const data = await response.json() as CustomResponse;
    return {
      content: data.choices?.[0]?.message?.content || 'No response from custom provider'
    };
  }
}
