import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { IntentClassifierService } from '../../services/intent/intent.classifier';
import { logger } from '../../utils/logger';

const ParseIntentInputSchema = z.object({
  prompt: z.string().min(3, 'Prompt must be at least 3 characters long'),
});

export const intentRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.post('/parse', async (request, reply) => {
    const parseResult = ParseIntentInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        issues: parseResult.error.errors,
      });
    }

    const { prompt } = parseResult.data;
    logger.info({ prompt }, 'Received intent parsing request');

    try {
      const result = await IntentClassifierService.classify(prompt);
      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      logger.error({ err: err?.message, prompt }, 'Failed to parse intent');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err?.message || 'Failed to process intent classification',
      });
    }
  });
};
