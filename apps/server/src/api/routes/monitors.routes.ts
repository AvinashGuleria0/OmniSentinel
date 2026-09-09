import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { eq, desc, asc, and } from 'drizzle-orm';
import { z } from 'zod';
import { CreateMonitorInputSchema, UpdateMonitorInputSchema } from '@omnisentinel/shared';
import { db, monitors, checkLogs, users, Monitor } from '../../db';
import { executionQueue } from '../../queues';
import { logger } from '../../utils/logger';

// Memoized demo user ID for quick local resolution
let cachedUserId: string | null = null;

async function resolveUserId(request: any): Promise<string> {
  const headerUserId = request.headers['x-user-id'];
  if (headerUserId && typeof headerUserId === 'string') {
    return headerUserId;
  }

  if (cachedUserId) {
    return cachedUserId;
  }

  // Find or create default demo user
  const existingUser = await db.query.users.findFirst();
  if (existingUser) {
    cachedUserId = existingUser.id;
    return cachedUserId;
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email: 'demo@omnisentinel.dev',
      telegramChatId: '123456789',
      preferredChannel: 'TELEGRAM',
    })
    .returning();

  cachedUserId = newUser.id;
  return cachedUserId;
}

const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid monitor ID format'),
});

export const monitorsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 1. POST /api/v1/monitors - Create a new monitor & enqueue immediate check
  server.post('/', async (request, reply) => {
    const parseResult = CreateMonitorInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        issues: parseResult.error.errors,
      });
    }

    const userId = await resolveUserId(request);
    const input = parseResult.data;

    try {
      const [newMonitor] = await db
        .insert(monitors)
        .values({
          userId,
          title: input.title,
          type: input.type,
          status: 'ACTIVE',
          targetUrl: input.targetUrl || null,
          targetSymbol: input.targetSymbol || null,
          rawPrompt: input.rawPrompt,
          conditionOperator: input.conditionOperator,
          targetValue: input.targetValue !== null && input.targetValue !== undefined ? String(input.targetValue) : null,
          currency: input.currency || 'INR',
          filterMetadata: input.filterMetadata || {},
          frequencyMinutes: input.frequencyMinutes || 60,
          nextRunAt: new Date(),
        })
        .returning();

      logger.info({ monitorId: newMonitor.id, title: newMonitor.title }, 'Created monitor successfully');

      // Immediately enqueue the first check in BullMQ
      try {
        await executionQueue.add(`immediate-${newMonitor.id}`, {
          monitorId: newMonitor.id,
          userId: newMonitor.userId,
          type: newMonitor.type,
          targetUrl: newMonitor.targetUrl,
          targetSymbol: newMonitor.targetSymbol,
          conditionOperator: newMonitor.conditionOperator as any,
          targetValue: newMonitor.targetValue ? Number(newMonitor.targetValue) : null,
          rawPrompt: newMonitor.rawPrompt,
          lastHash: newMonitor.lastContentHash,
          filterMetadata: (newMonitor.filterMetadata as Record<string, any>) || {},
        });
        logger.info({ monitorId: newMonitor.id }, 'Enqueued immediate initial check for monitor');
      } catch (queueErr: any) {
        logger.warn({ err: queueErr?.message, monitorId: newMonitor.id }, 'Could not enqueue immediate check (Redis offline or busy)');
      }

      return reply.status(201).send({
        success: true,
        data: newMonitor,
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Failed to create monitor');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to persist monitor',
      });
    }
  });

  // 2. GET /api/v1/monitors - List all monitors for user
  server.get('/', async (request, reply) => {
    try {
      const userId = await resolveUserId(request);
      const userMonitors = await db.query.monitors.findMany({
        where: eq(monitors.userId, userId),
        orderBy: [desc(monitors.createdAt)],
      });

      return reply.send({
        success: true,
        data: userMonitors,
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Failed to list monitors');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to retrieve monitors',
      });
    }
  });

  // 3. GET /api/v1/monitors/:id - Fetch single monitor details
  server.get('/:id', async (request, reply) => {
    const paramResult = UuidParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid monitor ID format',
      });
    }

    try {
      const userId = await resolveUserId(request);
      const monitor = await db.query.monitors.findFirst({
        where: and(eq(monitors.id, paramResult.data.id), eq(monitors.userId, userId)),
      });

      if (!monitor) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Monitor with ID ${paramResult.data.id} was not found`,
        });
      }

      return reply.send({
        success: true,
        data: monitor,
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Failed to fetch monitor');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to retrieve monitor details',
      });
    }
  });

  // 4. PATCH /api/v1/monitors/:id - Update filters, threshold, or re-arm snoozed monitor
  server.patch('/:id', async (request, reply) => {
    const paramResult = UuidParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid monitor ID format',
      });
    }

    const bodyResult = UpdateMonitorInputSchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        issues: bodyResult.error.errors,
      });
    }

    try {
      const userId = await resolveUserId(request);
      const { id } = paramResult.data;
      const updates = bodyResult.data;

      const existingMonitor = await db.query.monitors.findFirst({
        where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
      });

      if (!existingMonitor) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Monitor with ID ${id} was not found`,
        });
      }

      const updateValues: Partial<Monitor> = {
        updatedAt: new Date(),
      };

      if (updates.title !== undefined) updateValues.title = updates.title;
      if (updates.frequencyMinutes !== undefined) updateValues.frequencyMinutes = updates.frequencyMinutes;
      if (updates.filterMetadata !== undefined) updateValues.filterMetadata = updates.filterMetadata;
      if (updates.targetValue !== undefined) {
        updateValues.targetValue = updates.targetValue !== null ? String(updates.targetValue) : null;
      }

      // Re-arming or status transition
      if (updates.status !== undefined) {
        updateValues.status = updates.status;
        if (updates.status === 'ACTIVE') {
          updateValues.snoozedUntil = null;
          updateValues.consecutiveFailures = 0;
          updateValues.nextRunAt = new Date();
        }
      }

      const [updatedMonitor] = await db
        .update(monitors)
        .set(updateValues)
        .where(eq(monitors.id, id))
        .returning();

      // If re-armed to ACTIVE, enqueue immediate check
      if (updates.status === 'ACTIVE') {
        try {
          await executionQueue.add(`rearm-${id}`, {
            monitorId: updatedMonitor.id,
            userId: updatedMonitor.userId,
            type: updatedMonitor.type,
            targetUrl: updatedMonitor.targetUrl,
            targetSymbol: updatedMonitor.targetSymbol,
            conditionOperator: updatedMonitor.conditionOperator as any,
            targetValue: updatedMonitor.targetValue ? Number(updatedMonitor.targetValue) : null,
            rawPrompt: updatedMonitor.rawPrompt,
            lastHash: updatedMonitor.lastContentHash,
            filterMetadata: (updatedMonitor.filterMetadata as Record<string, any>) || {},
          });
          logger.info({ monitorId: id }, 'Enqueued immediate check on re-arm');
        } catch (queueErr: any) {
          logger.warn({ err: queueErr?.message, monitorId: id }, 'Could not enqueue immediate check on re-arm');
        }
      }

      return reply.send({
        success: true,
        data: updatedMonitor,
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Failed to update monitor');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to update monitor',
      });
    }
  });

  // 5. DELETE /api/v1/monitors/:id - Cascade delete monitor and associated history
  server.delete('/:id', async (request, reply) => {
    const paramResult = UuidParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid monitor ID format',
      });
    }

    try {
      const userId = await resolveUserId(request);
      const { id } = paramResult.data;

      const existing = await db.query.monitors.findFirst({
        where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
      });

      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Monitor with ID ${id} was not found`,
        });
      }

      await db.delete(monitors).where(eq(monitors.id, id));
      logger.info({ monitorId: id }, 'Deleted monitor successfully');

      return reply.send({
        success: true,
        message: 'Monitor deleted successfully',
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Failed to delete monitor');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to delete monitor',
      });
    }
  });

  // 6. GET /api/v1/monitors/:id/history - Time-series logs for Recharts
  server.get('/:id/history', async (request, reply) => {
    const paramResult = UuidParamSchema.safeParse(request.params);
    if (!paramResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid monitor ID format',
      });
    }

    try {
      const userId = await resolveUserId(request);
      const { id } = paramResult.data;

      const monitor = await db.query.monitors.findFirst({
        where: and(eq(monitors.id, id), eq(monitors.userId, userId)),
      });

      if (!monitor) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Monitor with ID ${id} was not found`,
        });
      }

      const logs = await db.query.checkLogs.findMany({
        where: eq(checkLogs.monitorId, id),
        orderBy: [asc(checkLogs.createdAt)],
        limit: 100,
      });

      const historyPoints = logs.map((log) => ({
        id: log.id,
        status: log.status,
        recordedValue: log.recordedValue ? Number(log.recordedValue) : null,
        screenshotUrl: log.screenshotUrl,
        metadata: log.metadata,
        timestamp: log.createdAt.toISOString(),
      }));

      return reply.send({
        success: true,
        data: historyPoints,
      });
    } catch (err: any) {
      logger.error({ err: err?.message }, 'Failed to fetch check logs history');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to retrieve monitor history',
      });
    }
  });
};
