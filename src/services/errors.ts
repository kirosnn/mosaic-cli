export enum AIErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',
  BASE_URL_MISSING = 'BASE_URL_MISSING',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  INVALID_REQUEST_ERROR = 'INVALID_REQUEST_ERROR',
  API_ERROR = 'API_ERROR',
  STREAM_ERROR = 'STREAM_ERROR',
  PARSING_ERROR = 'PARSING_ERROR',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  CONTEXT_LENGTH_EXCEEDED = 'CONTEXT_LENGTH_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface AIErrorDetails {
  type: AIErrorType;
  message: string;
  statusCode?: number;
  provider: string;
  model?: string;
  retryable: boolean;
  originalError?: unknown;
}

export class AIError extends Error {
  public readonly type: AIErrorType;
  public readonly statusCode?: number;
  public readonly provider: string;
  public readonly model?: string;
  public readonly retryable: boolean;
  public readonly originalError?: unknown;

  constructor(details: AIErrorDetails) {
    super(details.message);
    this.name = 'AIError';
    this.type = details.type;
    this.statusCode = details.statusCode;
    this.provider = details.provider;
    this.model = details.model;
    this.retryable = details.retryable;
    this.originalError = details.originalError;

    Object.setPrototypeOf(this, AIError.prototype);
  }

  static fromResponse(response: Response, provider: string, model?: string, errorBody?: any): AIError {
    const statusCode = response.status;
    let type: AIErrorType;
    let retryable = false;
    let message = errorBody?.error?.message || errorBody?.message || response.statusText || 'Unknown error';

    switch (statusCode) {
      case 401:
      case 403:
        type = AIErrorType.AUTHENTICATION_ERROR;
        retryable = false;
        break;
      case 429:
        type = AIErrorType.RATE_LIMIT_ERROR;
        retryable = true;
        break;
      case 400:
        if (message.toLowerCase().includes('context') || message.toLowerCase().includes('token')) {
          type = AIErrorType.CONTEXT_LENGTH_EXCEEDED;
        } else if (message.toLowerCase().includes('model')) {
          type = AIErrorType.MODEL_NOT_FOUND;
        } else {
          type = AIErrorType.INVALID_REQUEST_ERROR;
        }
        retryable = false;
        break;
      case 404:
        type = AIErrorType.MODEL_NOT_FOUND;
        retryable = false;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        type = AIErrorType.API_ERROR;
        retryable = true;
        break;
      default:
        type = AIErrorType.API_ERROR;
        retryable = statusCode >= 500;
    }

    return new AIError({
      type,
      message: `${provider} API error (${statusCode}): ${message}`,
      statusCode,
      provider,
      model,
      retryable,
      originalError: errorBody
    });
  }

  static fromNetworkError(error: unknown, provider: string, model?: string): AIError {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = message.toLowerCase().includes('timeout') || message.toLowerCase().includes('aborted');

    return new AIError({
      type: isTimeout ? AIErrorType.TIMEOUT_ERROR : AIErrorType.NETWORK_ERROR,
      message: `${provider} network error: ${message}`,
      provider,
      model,
      retryable: true,
      originalError: error
    });
  }

  static missingApiKey(provider: string): AIError {
    return new AIError({
      type: AIErrorType.API_KEY_MISSING,
      message: `${provider} API key not found. Please configure it in settings.`,
      provider,
      retryable: false
    });
  }

  static missingBaseUrl(provider: string): AIError {
    return new AIError({
      type: AIErrorType.BASE_URL_MISSING,
      message: `${provider} base URL not configured. Please set it in settings.`,
      provider,
      retryable: false
    });
  }

  static streamError(provider: string, message: string, model?: string): AIError {
    return new AIError({
      type: AIErrorType.STREAM_ERROR,
      message: `${provider} streaming error: ${message}`,
      provider,
      model,
      retryable: false
    });
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      statusCode: this.statusCode,
      provider: this.provider,
      model: this.model,
      retryable: this.retryable
    };
  }
}
