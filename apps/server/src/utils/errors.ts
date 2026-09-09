export class ApplicationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} with id ${id} not found` : `${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ScrapingBlockedError extends ApplicationError {
  constructor(url: string, reason = 'Access denied by Cloudflare / Anti-bot challenge') {
    super(`Scraping blocked for ${url}: ${reason}`, 403, 'SCRAPING_BLOCKED');
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}
