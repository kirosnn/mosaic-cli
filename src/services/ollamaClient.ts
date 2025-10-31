import { Ollama } from 'ollama';
import { AIError, AIErrorType } from './errors.js';
import type { Message } from './aiProvider.js';

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: Date | string;
}

export class OllamaClient {
  private client: Ollama;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.client = new Ollama({ host: baseUrl });
  }

  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await this.client.list();
      return response.models.map((model: any) => ({
        name: model.name,
        size: model.size,
        digest: model.digest,
        modified_at: model.modified_at
      }));
    } catch (error) {
      throw AIError.fromNetworkError(error, 'Ollama');
    }
  }

  async checkModelExists(modelName: string): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.some(model => model.name === modelName || model.name.startsWith(modelName));
    } catch {
      return false;
    }
  }

  async pullModel(modelName: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      const stream = await this.client.pull({
        model: modelName,
        stream: true
      });

      for await (const part of stream) {
        if (part.status === 'success') {
          onProgress?.(100);
          return;
        }
        if (part.total && part.completed) {
          const progress = (part.completed / part.total) * 100;
          onProgress?.(progress);
        }
      }
    } catch (error) {
      throw new AIError({
        type: AIErrorType.API_ERROR,
        message: `Failed to pull Ollama model "${modelName}": ${error instanceof Error ? error.message : String(error)}`,
        provider: 'Ollama',
        model: modelName,
        retryable: true,
        originalError: error
      });
    }
  }

  async chat(model: string, messages: Message[]): Promise<any> {
    try {
      const exists = await this.checkModelExists(model);
      if (!exists) {
        throw new AIError({
          type: AIErrorType.MODEL_NOT_FOUND,
          message: `Ollama model "${model}" not found. Please pull it first with: ollama pull ${model}`,
          provider: 'Ollama',
          model,
          retryable: false
        });
      }

      const response = await this.client.chat({
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: false
      });

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('model') && error.message.includes('not found')) {
          throw new AIError({
            type: AIErrorType.MODEL_NOT_FOUND,
            message: `Ollama model "${model}" not found. Please pull it first with: ollama pull ${model}`,
            provider: 'Ollama',
            model,
            retryable: false,
            originalError: error
          });
        }
      }

      throw AIError.fromNetworkError(error, 'Ollama', model);
    }
  }

  async chatStream(model: string, messages: Message[]): Promise<AsyncIterable<any>> {
    try {
      const exists = await this.checkModelExists(model);
      if (!exists) {
        throw new AIError({
          type: AIErrorType.MODEL_NOT_FOUND,
          message: `Ollama model "${model}" not found. Please pull it first with: ollama pull ${model}`,
          provider: 'Ollama',
          model,
          retryable: false
        });
      }

      const stream = await this.client.chat({
        model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: true
      });

      return stream;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('model') && error.message.includes('not found')) {
          throw new AIError({
            type: AIErrorType.MODEL_NOT_FOUND,
            message: `Ollama model "${model}" not found. Please pull it first with: ollama pull ${model}`,
            provider: 'Ollama',
            model,
            retryable: false,
            originalError: error
          });
        }
      }

      throw AIError.fromNetworkError(error, 'Ollama', model);
    }
  }

  async getModelInfo(modelName: string): Promise<any> {
    try {
      return await this.client.show({ model: modelName });
    } catch (error) {
      throw AIError.fromNetworkError(error, 'Ollama', modelName);
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
