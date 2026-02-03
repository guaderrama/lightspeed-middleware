import express from 'express';
import * as logger from 'firebase-functions/logger';
import { z } from 'zod';
import { CacheService } from '../services/cache';
import { GeminiService } from '../services/gemini';

const router = express.Router();
const cache = new CacheService();
const gemini = new GeminiService();

const ChatRequestSchema = z.object({
  question: z.string().min(1).max(500),
  context: z.object({
    brand: z.string().optional(),
    temporada: z.enum(['alta', 'baja']).optional()
  }).optional()
});

router.post('/ask', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';

  try {
    const validation = ChatRequestSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request inválido',
          details: validation.error.errors
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: correlationId
        }
      });
      return;
    }

    const { question, context } = validation.data;

    logger.info('Chat request', {
      correlationId,
      question: question.substring(0, 100)
    });

    if (!gemini.isConfigured()) {
      res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Gemini API no está configurada. Configure GEMINI_API_KEY.'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: correlationId
        }
      });
      return;
    }

    const inventoryContext = await cache.get('inventory-analysis');

    const fullContext = {
      ...context,
      inventory: inventoryContext
    };

    const { answer, cost } = await gemini.chat(question, fullContext);

    logger.info('Chat response generated', {
      correlationId,
      cost: `$${cost.toFixed(4)}`
    });

    res.status(200).json({
      data: {
        answer,
        cost,
        contextUsed: !!inventoryContext
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId,
        version: '1.0.0'
      }
    });
  } catch (error: any) {
    logger.error('Chat error', {
      correlationId,
      error: error.message
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Error al procesar pregunta'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId
      }
    });
  }
});

export default router;
