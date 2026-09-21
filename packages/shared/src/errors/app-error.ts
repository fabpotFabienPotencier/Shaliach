import type { ErrorCode } from './error-codes';

/**
 * Base application error class.
 * All domain errors extend from this.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown> | undefined;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Serialize to API error response format.
   */
  toJSON() {
    return {
      success: false as const,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        statusCode: this.statusCode,
      },
    };
  }
}

/**
 * 400 — Validation error.
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_FAILED', message, 400, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 401 — Authentication error.
 */
export class AuthenticationError extends AppError {
  constructor(code: ErrorCode = 'AUTH_UNAUTHORIZED', message: string = 'Unauthorized') {
    super(code, message, 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * 404 — Not found error.
 */
export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    const message = id ? `${entity} with ID ${id} not found` : `${entity} not found`;
    super('NOT_FOUND', message, 404, { entity, id });
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 — Conflict error.
 */
export class ConflictError extends AppError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, 409, details);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 429 — Rate limit error.
 */
export class RateLimitError extends AppError {
  public readonly retryAfterMs: number;

  constructor(message: string = 'Rate limit exceeded', retryAfterMs: number = 60000) {
    super('RATE_LIMITED', message, 429, { retryAfterMs });
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * 503 — Service unavailable error.
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, message?: string) {
    super(
      'SERVICE_UNAVAILABLE',
      message ?? `${service} is temporarily unavailable`,
      503,
      { service }
    );
    this.name = 'ServiceUnavailableError';
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}
