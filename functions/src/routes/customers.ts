import express from 'express';
import * as logger from 'firebase-functions/logger';
import { LightspeedClient } from '../services/lightspeed';
import { CacheService } from '../services/cache';

const router = express.Router();
const cache = new CacheService();
const lightspeedClient = new LightspeedClient(process.env.LIGHTSPEED_PERSONAL_TOKEN || '');

async function resolveOutletId(outletId: string): Promise<string> {
  if (outletId.includes('-') && outletId.length > 10) {
    return outletId;
  }
  let outlets = await cache.get<any[]>('outlets-list');
  if (!outlets) {
    outlets = await lightspeedClient.listOutlets();
    await cache.set('outlets-list', outlets, { ttl: 3600 });
  }
  if (outlets && outlets.length > 0) {
    logger.info(`Resolved outlet_id '${outletId}' to '${outlets[0].id}' (${outlets[0].name})`);
    return outlets[0].id;
  }
  throw new Error('No outlets found in Lightspeed');
}

/**
 * GET /customers/analytics
 * Customer analytics: segments, new vs returning, avg spend
 */
router.get('/analytics', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    const cacheKey = `customers-analytics-${date_from}-${date_to}-${outlet_id}`;
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      return res.status(200).json({
        data: cached,
        meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0', fromCache: true }
      });
    }

    const resolvedOutletId = await resolveOutletId(outlet_id as string);
    const data = await lightspeedClient.getCustomerAnalytics(date_from, date_to, resolvedOutletId);
    await cache.set(cacheKey, data, { ttl: 7200 }); // 2h cache

    return res.status(200).json({
      data,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in customers/analytics', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /customers/top
 * Top N customers by total spend
 */
router.get('/top', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id, limit } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    const topLimit = limit ? parseInt(limit as string) : 20;
    const cacheKey = `customers-top-${date_from}-${date_to}-${outlet_id}-${topLimit}`;
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      return res.status(200).json({
        data: cached,
        meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0', fromCache: true }
      });
    }

    const resolvedOutletId = await resolveOutletId(outlet_id as string);
    const analytics = await lightspeedClient.getCustomerAnalytics(date_from, date_to, resolvedOutletId, topLimit);
    await cache.set(cacheKey, analytics.top_customers, { ttl: 7200 });

    return res.status(200).json({
      data: analytics.top_customers,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in customers/top', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /customers/returns-summary
 * Returns analysis: rate, top returned products, totals
 */
router.get('/returns-summary', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    const cacheKey = `returns-summary-${date_from}-${date_to}-${outlet_id}`;
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      return res.status(200).json({
        data: cached,
        meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0', fromCache: true }
      });
    }

    const resolvedOutletId = await resolveOutletId(outlet_id as string);
    const data = await lightspeedClient.getReturnsSummary(date_from, date_to, resolvedOutletId);
    await cache.set(cacheKey, data, { ttl: 7200 });

    return res.status(200).json({
      data,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in customers/returns-summary', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

export default router;
