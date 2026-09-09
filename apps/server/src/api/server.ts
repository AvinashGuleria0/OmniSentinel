import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import crypto from 'crypto';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { intentRoutes } from './routes/intent.routes';
import { monitorsRoutes } from './routes/monitors.routes';

export async function buildServer(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false, // We use custom Pino logger hooks for clean correlation
    genReqId: () => crypto.randomUUID(),
    disableRequestLogging: true,
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false, // Allows flexible API usage across clients
  });

  // Cross-Origin Resource Sharing
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow localhost dev servers and server-to-server calls
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        cb(null, true);
        return;
      }
      cb(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Fastify sensible helpers (httpErrors, etc.)
  await app.register(sensible);

  // Request & response logging middleware
  app.addHook('onRequest', async (request) => {
    logger.debug(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
      },
      'Incoming HTTP Request'
    );
  });

  app.addHook('onResponse', async (request, reply) => {
    logger.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: Math.round(reply.elapsedTime),
      },
      'HTTP Request Completed'
    );
  });

  // Global Error Handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Schema validation error',
        issues: error.errors,
      });
    }

    const statusCode = error.statusCode || 500;
    logger.error(
      {
        reqId: request.id,
        statusCode,
        err: error.message,
        stack: error.stack,
      },
      'Unhandled HTTP Exception'
    );

    return reply.status(statusCode).send({
      statusCode,
      error: error.name || 'Internal Server Error',
      message: statusCode === 500 ? 'An unexpected internal error occurred' : error.message,
    });
  });

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'omnisentinel-api',
    };
  });

  // Register API v1 routes
  await app.register(intentRoutes, { prefix: '/api/v1/intent' });
  await app.register(monitorsRoutes, { prefix: '/api/v1/monitors' });

  return app;
}
