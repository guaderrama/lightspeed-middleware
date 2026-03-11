import express from 'express';
import * as logger from 'firebase-functions/logger';
import { z } from 'zod';
import { CacheService } from '../services/cache';
import { GeminiService } from '../services/gemini';
import { LightspeedClient } from '../services/lightspeed';

const router = express.Router();

// Lazy initialization — secrets are only available inside the handler at runtime
let _cache: CacheService | null = null;
function getCache(): CacheService {
  if (!_cache) { _cache = new CacheService(); }
  return _cache;
}

let _gemini: GeminiService | null = null;
function getGemini(): GeminiService {
  if (!_gemini) { _gemini = new GeminiService(); }
  return _gemini;
}

let _lightspeed: LightspeedClient | null = null;
function getLightspeed(): LightspeedClient {
  if (!_lightspeed) {
    const token = process.env.LIGHTSPEED_PERSONAL_TOKEN || '';
    _lightspeed = new LightspeedClient(token);
  }
  return _lightspeed;
}

const ChatRequestSchema = z.object({
  question: z.string().min(1).max(500),
  context: z.object({
    brand: z.string().optional(),
    temporada: z.enum(['alta', 'baja']).optional()
  }).optional()
});

/**
 * Helper function to get recent sales data
 */
async function getRecentSalesData() {
  try {
    // Get outlet info from cache or fetch it
    let outlets = await getCache().get<any[]>('outlets-list');
    if (!outlets) {
      outlets = await getLightspeed().listOutlets();
      await getCache().set('outlets-list', outlets, { ttl: 3600 }); // Cache for 1 hour
    }

    if (!outlets || outlets.length === 0) {
      logger.warn('No outlets found');
      return null;
    }

    const firstOutlet = outlets[0];
    const outletId = firstOutlet.id;

    // Get sales data for last 30 days
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);

    // Try to get from cache first
    const cacheKey = `sales-last-30-days-${outletId}`;
    let salesData = await getCache().get(cacheKey);

    if (!salesData) {
      // Fetch sales summary and top products
      const [salesSummary, topProducts] = await Promise.all([
        getLightspeed().getSalesSummary(
          dateFrom.toISOString(),
          dateTo.toISOString(),
          outletId,
          true
        ),
        getLightspeed().getTopSellingProducts(
          dateFrom.toISOString(),
          dateTo.toISOString(),
          outletId,
          20 // Top 20 products
        )
      ]);

      salesData = {
        summary: salesSummary,
        topProducts: topProducts,
        outlet: firstOutlet,
        period: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
          days: 30
        }
      };

      // Cache for 6 hours
      await getCache().set(cacheKey, salesData, { ttl: 21600 });
    }

    return salesData;
  } catch (error: any) {
    logger.error('Error fetching sales data for chat context', {
      error: error.message
    });
    return null;
  }
}

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

    if (!getGemini().isConfigured()) {
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

    const outletId = (req.query.outlet_id as string) || '0242e39e-bf6c-11eb-fc6f-29d74e175f8a';
    const inventoryContext = await getCache().get(`inventory-analysis-${outletId}`);
    const salesContext = await getRecentSalesData();

    const fullContext = {
      ...context,
      inventory: inventoryContext,
      sales: salesContext
    };

    const { answer, cost } = await getGemini().chat(question, fullContext);

    logger.info('Chat response generated', {
      correlationId,
      cost: `$${cost.toFixed(4)}`
    });

    res.status(200).json({
      data: {
        answer,
        cost,
        contextUsed: {
          inventory: !!inventoryContext,
          sales: !!salesContext
        }
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
        message: 'Error interno del servidor'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId
      }
    });
  }
});

export default router;
