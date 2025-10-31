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

interface XAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
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
  private readonly MAX_TOKENS = 16384;
  private readonly TOKEN_RATIO = 4;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.apiKey = getSecret(`${config.type}_api_key`);
    this.systemPrompt = loadSystemPrompt();
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
          return { content: '', error: 'Unknown provider type' };
      }
    } catch (error) {
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async sendMessageStream(messages: Message[], onDelta: (delta: string) => void): Promise<AIResponse> {
    try {
      const preparedMessages = this.prepareMessages(messages);

      switch (this.config.type) {
        case 'openai':
          return await this.streamOpenAI(preparedMessages, onDelta);
        case 'anthropic':
          return await this.streamAnthropic(preparedMessages, onDelta);
        case 'openrouter':
          return await this.streamOpenRouter(preparedMessages, onDelta);
        case 'ollama':
          return await this.streamOllama(preparedMessages, onDelta);
        case 'xai':
          return await this.streamXAI(preparedMessages, onDelta);
        case 'mistral':
          return await this.streamMistral(preparedMessages, onDelta);
        case 'custom':
          return await this.streamCustom(preparedMessages, onDelta);
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
        max_tokens: this.MAX_TOKENS,
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

  private async sendToXAI(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      return { content: '', error: 'xAI API key not found' };
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
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
      const errorData = await response.json().catch(() => ({})) as XAIResponse;
      return {
        content: '',
        error: `xAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }

    const data = await response.json() as XAIResponse;
    return {
      content: data.choices?.[0]?.message?.content || 'No response from xAI'
    };
  }

  private async sendToMistral(messages: Message[]): Promise<AIResponse> {
    if (!this.apiKey) {
      return { content: '', error: 'Mistral API key not found' };
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
      const errorData = await response.json().catch(() => ({})) as MistralResponse;
      return {
        content: '',
        error: `Mistral API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }

    const data = await response.json() as MistralResponse;
    return {
      content: data.choices?.[0]?.message?.content || 'No response from Mistral'
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

  private extractTextDelta(obj: any): string {
    if (obj && obj.choices && Array.isArray(obj.choices)) {
      const choice = obj.choices[0];
      if (choice && choice.delta && typeof choice.delta.content === 'string') {
        return choice.delta.content as string;
      }
      if (choice && choice.message && typeof choice.message.content === 'string') {
        return choice.message.content as string;
      }
    }
    if (obj && obj.delta && typeof obj.delta.text === 'string') {
      return obj.delta.text as string;
    }
    if (obj && obj.message && typeof obj.message.content === 'string') {
      return obj.message.content as string;
    }
    if (typeof obj?.content === 'string') {
      return obj.content as string;
    }
    if (obj && Array.isArray(obj.content) && obj.content[0] && typeof obj.content[0].text === 'string') {
      return obj.content[0].text as string;
    }
    return '';
  }

  private async streamOpenAI(messages: Message[], onDelta: (delta: string) => void): Promise<AIResponse> {
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
        stream: true
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as OpenAIResponse;
      return {
        content: '',
        error: `OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return { content: '', error: 'OpenAI stream unavailable' };
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let aggregated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx !== -1) {
        const eventStr = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = eventStr.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.replace(/^data:\s*/, '');
          if (payload === '[DONE]') {
            continue;
          }
          let obj: any;
          try {
            obj = JSON.parse(payload);
          } catch {
            obj = null;
          }
          if (!obj) continue;
          const text = this.extractTextDelta(obj);
          if (text) {
            aggregated += text;
            onDelta(text);
          }
        }
        idx = buffer.indexOf('\n\n');
      }
    }
    return { content: aggregated };
  }

  private async streamAnthropic(messages: Message[], onDelta: (delta: string) => void): Promise<AIResponse> {
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
        max_tokens: this.MAX_TOKENS,
        system: systemMessages.length > 0 ? systemMessages[0].content : undefined,
        messages: conversationMessages,
        stream: true
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as AnthropicResponse;
      return {
        content: '',
        error: `Anthropic API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return { content: '', error: 'Anthropic stream unavailable' };
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let aggregated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx !== -1) {
        const eventStr = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = eventStr.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.replace(/^data:\s*/, '');
          if (payload === '[DONE]') {
            continue;
          }
          let obj: any;
          try {
            obj = JSON.parse(payload);
          } catch {
            obj = null;
          }
          if (!obj) continue;
          const text = this.extractTextDelta(obj);
          if (text) {
            aggregated += text;
            onDelta(text);
          }
        }
        idx = buffer.indexOf('\n\n');
      }
    }
    return { content: aggregated };
  }

  private async streamOpenRouter(messages: Message[], onDelta: (delta: string) => void): Promise<AIResponse> {
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
        messages: messages,
        stream: true
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as OpenRouterResponse;
      return {
        content: '',
        error: `OpenRouter API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return { content: '', error: 'OpenRouter stream unavailable' };
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let aggregated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx !== -1) {
        const eventStr = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = eventStr.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.replace(/^data:\s*/, '');
          if (payload === '[DONE]') {
            continue;
          }
          let obj: any;
          try {
            obj = JSON.parse(payload);
          } catch {
            obj = null;
          }
          if (!obj) continue;
          const text = this.extractTextDelta(obj);
          if (text) {
            aggregated += text;
            onDelta(text);
          }
        }
        idx = buffer.indexOf('\n\n');
      }
    }
    return { content: aggregated };
  }

  private async streamOllama(messages: Message[], onDelta: (delta: string) => void): Promise<AIResponse> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        stream: true
      })
    });
    if (!response.ok) {
      return {
        content: '',
        error: `Ollama API error: ${response.status} - ${response.statusText}`
      };
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return { content: '', error: 'Ollama stream unavailable' };
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let aggregated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n');
      while (idx !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.length === 0) {
          idx = buffer.indexOf('\n');
          continue;
        }
        let obj: any;
        try {
          obj = JSON.parse(line);
        } catch {
          obj = null;
        }
        if (!obj) {
          idx = buffer.indexOf('\n');
          continue;
        }
        if (obj.error) {
          return { content: aggregated, error: obj.error };
        }
        const text = this.extractTextDelta(obj);
        if (text) {
          aggregated += text;
          onDelta(text);
        }
        idx = buffer.indexOf('\n');
      }
    }
    return { content: aggregated };
  }

  private async streamXAI(messages: Message[], onDelta: (delta: string) => void): Promise<AIResponse> {
    if (!this.apiKey) {
      return { content: '', error: 'xAI API key not found' };
    }
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        stream: true
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as XAIResponse;
      return {
        content: '',
        error: `xAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return { content: '', error: 'xAI stream unavailable' };
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let aggregated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx !== -1) {
        const eventStr = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = eventStr.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.replace(/^data:\s*/, '');
          if (payload === '[DONE]') {
            continue;
          }
          let obj: any;
          try {
            obj = JSON.parse(payload);
          } catch {
            obj = null;
          }
          if (!obj) continue;
          const text = this.extractTextDelta(obj);
          if (text) {
            aggregated += text;
            onDelta(text);
          }
        }
        idx = buffer.indexOf('\n\n');
      }
    }
    return { content: aggregated };
  }

  private async streamMistral(messages: Message[], onDelta: (delta: string) => void): Promise<AIResponse> {
    if (!this.apiKey) {
      return { content: '', error: 'Mistral API key not found' };
    }
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        stream: true
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as MistralResponse;
      return {
        content: '',
        error: `Mistral API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return { content: '', error: 'Mistral stream unavailable' };
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let aggregated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx !== -1) {
        const eventStr = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = eventStr.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.replace(/^data:\s*/, '');
          if (payload === '[DONE]') {
            continue;
          }
          let obj: any;
          try {
            obj = JSON.parse(payload);
          } catch {
            obj = null;
          }
          if (!obj) continue;
          const text = this.extractTextDelta(obj);
          if (text) {
            aggregated += text;
            onDelta(text);
          }
        }
        idx = buffer.indexOf('\n\n');
      }
    }
    return { content: aggregated };
  }

  private async streamCustom(messages: Message[], onDelta: (delta: string) => void): Promise<AIResponse> {
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
        stream: true
      })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as CustomResponse;
      return {
        content: '',
        error: `Custom provider error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`
      };
    }
    const reader = response.body?.getReader();
    if (!reader) {
      return { content: '', error: 'Custom provider stream unavailable' };
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let aggregated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n\n');
      while (idx !== -1) {
        const eventStr = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = eventStr.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          const payload = line.replace(/^data:\s*/, '');
          if (payload === '[DONE]') {
            continue;
          }
          let obj: any;
          try {
            obj = JSON.parse(payload);
          } catch {
            obj = null;
          }
          if (!obj) continue;
          const text = this.extractTextDelta(obj);
          if (text) {
            aggregated += text;
            onDelta(text);
          }
        }
        idx = buffer.indexOf('\n\n');
      }
    }
    return { content: aggregated };
  }
}
