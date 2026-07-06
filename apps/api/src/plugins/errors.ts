import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/** Прикладная ошибка с HTTP-статусом и машинным кодом. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'bad_request', message, details);
  }
  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(401, 'unauthorized', message);
  }
  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(403, 'forbidden', message);
  }
  static notFound(message = 'Not found'): AppError {
    return new AppError(404, 'not_found', message);
  }
  static conflict(message: string): AppError {
    return new AppError(409, 'conflict', message);
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      error: { code: 'not_found', message: `Route ${request.method} ${request.url} not found` },
    });
  });

  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      });
      return;
    }

    if (error instanceof ZodError) {
      reply.status(400).send({
        error: { code: 'validation_error', message: 'Invalid request', details: error.flatten() },
      });
      return;
    }

    const err = error as { statusCode?: number; message?: string };
    const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error(error);
    }
    reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? 'internal_error' : 'request_error',
        message: statusCode >= 500 ? 'Internal server error' : (err.message ?? 'Request error'),
      },
    });
  });
}
