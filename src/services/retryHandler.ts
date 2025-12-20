import { AIError } from './errors.js';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  timeoutMs: 120000
};

export class RetryHandler {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateDelay(attemptNumber: number): number {
    const delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attemptNumber);
    return Math.min(delay, this.config.maxDelayMs);
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    let lastError: Error | AIError | unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Operation timed out after ${this.config.timeoutMs}ms`)), this.config.timeoutMs);
        });

        const result = await Promise.race([operation(), timeoutPromise]);
        return result;
      } catch (error) {
        lastError = error;

        const isLastAttempt = attempt === this.config.maxRetries;

        if (error instanceof AIError) {
          if (!error.retryable || isLastAttempt) {
            throw error;
          }
        } else if (isLastAttempt) {
          throw error;
        }

        if (!isLastAttempt) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = this.config.timeoutMs
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([operation(), timeoutPromise]);
  }
}