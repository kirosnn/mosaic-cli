import { Ollama } from 'ollama';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import { AIError, AIErrorType } from './errors.js';
import type { Message } from './aiProvider.js';

const execAsync = promisify(exec);

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: Date | string;
}

export interface PullProgress {
  status: string;
  total?: number;
  completed?: number;
}

export class OllamaClient {
  private client: Ollama;
  private baseUrl: string;
  private connectionVerified: boolean = false;
  private authenticationInProgress: boolean = false;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.client = new Ollama({ host: baseUrl });
  }

  private async openUrl(url: string): Promise<void> {
    const platformName = platform();
    let command: string;

    switch (platformName) {
      case 'darwin':
        command = `open "${url}"`;
        break;
      case 'win32':
        command = `start "" "${url}"`;
        break;
      default:
        command = `xdg-open "${url}"`;
        break;
    }

    try {
      await execAsync(command);
    } catch (error) {
      console.error('Failed to open browser:', error);
    }
  }

  private async startOllama(): Promise<boolean> {
    try {
      const platformName = platform();

      if (platformName === 'win32') {
        spawn('ollama', ['serve'], {
          detached: true,
          stdio: 'ignore',
          shell: true
        }).unref();
      } else {
        spawn('ollama', ['serve'], {
          detached: true,
          stdio: 'ignore'
        }).unref();
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      for (let i = 0; i < 10; i++) {
        try {
          await this.client.list();
          return true;
        } catch {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to start Ollama:', error);
      return false;
    }
  }

  private async handleAuthentication(signinUrl: string): Promise<void> {
    if (this.authenticationInProgress) {
      throw new AIError({
        type: AIErrorType.AUTHENTICATION_ERROR,
        message: 'Authentication already in progress. Please complete the authentication in your browser.',
        provider: 'Ollama',
        retryable: false
      });
    }

    this.authenticationInProgress = true;

    try {
      console.log('\nOpening browser for Ollama authentication...');
      await this.openUrl(signinUrl);

      console.log('Waiting for authentication to complete...');

      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          await this.client.list();
          this.connectionVerified = true;
          console.log('Authentication successful!');
          this.authenticationInProgress = false;
          return;
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.toLowerCase().includes('unauthorized')) {
            throw error;
          }
        }
      }

      this.authenticationInProgress = false;
      throw new AIError({
        type: AIErrorType.AUTHENTICATION_ERROR,
        message: 'Authentication timeout. Please try again.',
        provider: 'Ollama',
        retryable: true
      });
    } catch (error) {
      this.authenticationInProgress = false;
      throw error;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.list();
      this.connectionVerified = true;
      return true;
    } catch (error) {
      this.connectionVerified = false;
      const message = error instanceof Error ? error.message : String(error);

      if (message.toLowerCase().includes('unauthorized')) {
        const signinMatch = message.match(/signin_url":"([^"]+)"/);
        const signinUrl = signinMatch ? signinMatch[1].replace(/\\u0026/g, '&') : null;

        if (signinUrl) {
          await this.handleAuthentication(signinUrl);
          return true;
        }

        throw new AIError({
          type: AIErrorType.AUTHENTICATION_ERROR,
          message: 'Ollama requires authentication. Please run: ollama signin',
          provider: 'Ollama',
          retryable: false,
          originalError: error
        });
      }

      if (message.toLowerCase().includes('econnrefused') ||
        message.toLowerCase().includes('connection refused') ||
        message.toLowerCase().includes('fetch failed')) {

        console.log('Ollama is not running. Attempting to start...');
        const started = await this.startOllama();

        if (started) {
          this.connectionVerified = true;
          return true;
        }

        throw AIError.ollamaNotRunning();
      }

      throw AIError.fromNetworkError(error, 'Ollama');
    }
  }

  async ensureConnection(): Promise<void> {
    if (!this.connectionVerified) {
      await this.checkConnection();
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    try {
      await this.ensureConnection();
      const response = await this.client.list();
      return response.models.map((model: any) => ({
        name: model.name,
        size: model.size,
        digest: model.digest,
        modified_at: model.modified_at
      }));
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
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

  async pullModel(modelName: string, onProgress?: (progress: PullProgress) => void): Promise<void> {
    try {
      await this.ensureConnection();

      const stream = await this.client.pull({
        model: modelName,
        stream: true
      });

      for await (const part of stream) {
        onProgress?.({
          status: part.status || 'pulling',
          total: part.total,
          completed: part.completed
        });

        if (part.status === 'success') {
          return;
        }
      }
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('unauthorized')) {
        const signinMatch = message.match(/signin_url":"([^"]+)"/);
        const signinUrl = signinMatch ? signinMatch[1].replace(/\\u0026/g, '&') : null;

        if (signinUrl) {
          await this.handleAuthentication(signinUrl);
          return this.pullModel(modelName, onProgress);
        }
      }

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

  async ensureModelExists(modelName: string, onProgress?: (progress: PullProgress) => void): Promise<void> {
    const exists = await this.checkModelExists(modelName);
    if (!exists) {
      console.log(`Downloading model "${modelName}"...`);
      await this.pullModel(modelName, onProgress);
    }
  }

  async chat(model: string, messages: Message[], autoPull: boolean = true): Promise<any> {
    try {
      await this.ensureConnection();

      if (autoPull) {
        await this.ensureModelExists(model);
      } else {
        const exists = await this.checkModelExists(model);
        if (!exists) {
          throw new AIError({
            type: AIErrorType.MODEL_NOT_FOUND,
            message: `Ollama model "${model}" not found. The model will be automatically pulled on next request.`,
            provider: 'Ollama',
            model,
            retryable: false
          });
        }
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
      if (error instanceof AIError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      if (message.toLowerCase().includes('unauthorized')) {
        const signinMatch = message.match(/signin_url":"([^"]+)"/);
        const signinUrl = signinMatch ? signinMatch[1].replace(/\\u0026/g, '&') : null;

        if (signinUrl) {
          await this.handleAuthentication(signinUrl);
          return this.chat(model, messages, autoPull);
        }
      }

      if (message.includes('model') && message.includes('not found')) {
        throw new AIError({
          type: AIErrorType.MODEL_NOT_FOUND,
          message: `Ollama model "${model}" not found. The model will be automatically pulled on next request.`,
          provider: 'Ollama',
          model,
          retryable: false,
          originalError: error
        });
      }

      throw AIError.fromNetworkError(error, 'Ollama', model);
    }
  }

  async chatStream(model: string, messages: Message[], autoPull: boolean = true): Promise<AsyncIterable<any>> {
    try {
      await this.ensureConnection();

      if (autoPull) {
        await this.ensureModelExists(model);
      } else {
        const exists = await this.checkModelExists(model);
        if (!exists) {
          throw new AIError({
            type: AIErrorType.MODEL_NOT_FOUND,
            message: `Ollama model "${model}" not found. The model will be automatically pulled on next request.`,
            provider: 'Ollama',
            model,
            retryable: false
          });
        }
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
      if (error instanceof AIError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      if (message.toLowerCase().includes('unauthorized')) {
        const signinMatch = message.match(/signin_url":"([^"]+)"/);
        const signinUrl = signinMatch ? signinMatch[1].replace(/\\u0026/g, '&') : null;

        if (signinUrl) {
          await this.handleAuthentication(signinUrl);
          return this.chatStream(model, messages, autoPull);
        }
      }

      if (message.includes('model') && message.includes('not found')) {
        throw new AIError({
          type: AIErrorType.MODEL_NOT_FOUND,
          message: `Ollama model "${model}" not found. The model will be automatically pulled on next request.`,
          provider: 'Ollama',
          model,
          retryable: false,
          originalError: error
        });
      }

      throw AIError.fromNetworkError(error, 'Ollama', model);
    }
  }

  async getModelInfo(modelName: string): Promise<any> {
    try {
      await this.ensureConnection();
      return await this.client.show({ model: modelName });
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw AIError.fromNetworkError(error, 'Ollama', modelName);
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  isConnected(): boolean {
    return this.connectionVerified;
  }
}