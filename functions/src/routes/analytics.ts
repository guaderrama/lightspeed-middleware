import express from 'express';
import * as logger from 'firebase-functions/logger';
import { CacheService } from '../services/cache';
import { AnalyticsService } from '../services/analytics';
import { LightspeedClient } from '../services/lightspeed';
import { GeminiService } from '../services/gemini';
import { InventoryAnalysis } from '../types/analytics';

const router = express.Router();

// Lazy initialization — secrets are only available inside the handler at runtime
let _cache: CacheService | null = null;
function getCache(): CacheService {
  if (!_cache) { _cache = new CacheService(); }
  return _cache;
}

let _analytics: AnalyticsService | null = null;
function getAnalytics(): AnalyticsService {
  if (!_analytics) {
    const token = process.env.LIGHTSPEED_PERSONAL_TOKEN || '';
    _analytics = new AnalyticsService(token);
  }
  return _analytics;
}

let _lightspeedClient: LightspeedClient | null = null;
function getLightspeedClient(): LightspeedClient {
  if (!_lightspeedClient) {
    const token = process.env.LIGHTSPEED_PERSONAL_TOKEN || '';
    _lightspeedClient = new LightspeedClient(token);
  }
  return _lightspeedClient;
}

let _gemini: GeminiService | null = null;
function getGemini(): GeminiService {
  if (!_gemini) { _gemini = new GeminiService(); }
  return _gemini;
}

/**
 * Resolves outlet_id from query params or returns default
 */
function resolveOutletId(req: express.Request): string {
  return (req.query.outlet_id as string) || '0242e39e-bf6c-11eb-fc6f-29d74e175f8a';
}

/**
 * GET /analytics/inventory-status
 * Retorna analisis completo del inventario (con cache)
 * Now accepts ?outlet_id= parameter for real data
 */
router.get('/inventory-status', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';
  const outletId = resolveOutletId(req);
  const cacheKey = `inventory-analysis-${outletId}`;

  try {
    logger.info('Inventory status request', { correlationId, outletId });

    let analysis = await getCache().get<InventoryAnalysis>(cacheKey);
    const fromCache = !!analysis;

    if (!analysis) {
      logger.info('Cache miss - calculating REAL metrics', { correlationId, outletId });
      analysis = await getAnalytics().calculateMetrics(outletId);
      await getCache().set(cacheKey, analysis, { ttl: 21600 }); // 6h cache
    }

    res.status(200).json({
      data: analysis,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId,
        fromCache,
        version: '2.0.0'
      }
    });
  } catch (error: any) {
    logger.error('Error fetching inventory status', { correlationId, error: error.message });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * POST /analytics/refresh
 * Fuerza recalcular analisis (invalida cache)
 */
router.post('/refresh', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';
  const outletId = resolveOutletId(req);
  const cacheKey = `inventory-analysis-${outletId}`;

  try {
    logger.info('Force refresh requested', { correlationId, outletId });
    await getCache().delete(cacheKey);
    const analysis = await getAnalytics().calculateMetrics(outletId);
    await getCache().set(cacheKey, analysis, { ttl: 21600 });

    res.status(200).json({
      data: analysis,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId,
        refreshed: true,
        version: '2.0.0'
      }
    });
  } catch (error: any) {
    logger.error('Error refreshing analysis', { correlationId, error: error.message });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /analytics/low-stock
 * Retorna productos con stock bajo (por debajo del ROP o con cobertura < 14 dias)
 */
router.get('/low-stock', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';
  const outletId = resolveOutletId(req);
  const cacheKey = `inventory-analysis-${outletId}`;

  try {
    logger.info('Low stock request', { correlationId, outletId });

    let analysis = await getCache().get<InventoryAnalysis>(cacheKey);
    if (!analysis) {
      logger.info('Cache miss - calculating metrics for low-stock', { correlationId });
      analysis = await getAnalytics().calculateMetrics(outletId);
      await getCache().set(cacheKey, analysis, { ttl: 21600 });
    }

    const lowStockProducts = analysis.metricas.filter(
      (p) => p.stock_actual < p.rop || p.cobertura_dias < 14
    );
    const stockIssues = analysis.recomendaciones.filter(
      (r) => r.motivo === 'quiebre' || r.motivo === 'reabastecer'
    );

    res.status(200).json({
      data: { total: lowStockProducts.length, products: lowStockProducts, issues: stockIssues },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error fetching low stock', { correlationId, error: error.message });
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /analytics/outlets
 * Returns list of available outlets from Lightspeed (cached 1h)
 */
router.get('/outlets', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';

  try {
    let outlets = await getCache().get<any[]>('outlets-list');

    if (!outlets) {
      logger.info('Fetching outlets from Lightspeed', { correlationId });
      outlets = await getLightspeedClient().listOutlets();
      await getCache().set('outlets-list', outlets, { ttl: 3600 });
    }

    return res.status(200).json({
      data: outlets,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error fetching outlets', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /analytics/alerts
 * Returns AI-powered alerts combining inventory data with Gemini forecast
 * Cached for 30 minutes
 */
router.get('/alerts', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';
  const outletId = resolveOutletId(req);

  try {
    const alertsCacheKey = `ai-alerts-${outletId}`;
    let alerts = await getCache().get<any>(alertsCacheKey);

    if (!alerts) {
      logger.info('Generating AI alerts', { correlationId, outletId });

      const analysisCacheKey = `inventory-analysis-${outletId}`;
      let analysis = await getCache().get<InventoryAnalysis>(analysisCacheKey);
      if (!analysis) {
        analysis = await getAnalytics().calculateMetrics(outletId);
        await getCache().set(analysisCacheKey, analysis, { ttl: 21600 });
      }

      const salesContext = {
        total_products: analysis.metricas.length,
        critical_issues: analysis.recomendaciones.filter((r) => r.prioridad === 'alta').length,
        stockout_risk: analysis.listas_rapidas?.quiebres_inminentes?.length ?? 0,
        overstock: analysis.listas_rapidas?.sobrestock?.length ?? 0,
        slow_moving: analysis.listas_rapidas?.lenta_rotacion?.length ?? 0,
      };

      alerts = await getGemini().forecastDemand(salesContext, {
        metricas_sample: analysis.metricas.slice(0, 20),
        recomendaciones: analysis.recomendaciones.slice(0, 15),
      });

      await getCache().set(alertsCacheKey, alerts, { ttl: 1800 });
    }

    return res.status(200).json({
      data: alerts,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error generating alerts', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /analytics/profit-analysis
 * Returns profit/margin analysis for a date range
 */
router.get('/profit-analysis', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';
  const outletId = resolveOutletId(req);
  const dateFrom = req.query.date_from as string;
  const dateTo = req.query.date_to as string;

  if (!dateFrom || !dateTo) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }

  const cacheKey = `profit-analysis-${outletId}-${dateFrom}-${dateTo}`;

  try {
    let data = await getCache().get<any>(cacheKey);

    if (!data) {
      logger.info('Calculating profit analysis', { correlationId, outletId, dateFrom, dateTo });
      data = await getAnalytics().getProfitAnalysis(outletId, dateFrom, dateTo);
      await getCache().set(cacheKey, data, { ttl: 7200 }); // 2h cache
    }

    return res.status(200).json({
      data,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in profit-analysis', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /analytics/category-intelligence
 * Returns deep metrics per product category
 */
router.get('/category-intelligence', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';
  const outletId = resolveOutletId(req);
  const dateFrom = req.query.date_from as string;
  const dateTo = req.query.date_to as string;

  if (!dateFrom || !dateTo) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }

  const cacheKey = `category-intelligence-${outletId}-${dateFrom}-${dateTo}`;

  try {
    let data = await getCache().get<any>(cacheKey);

    if (!data) {
      logger.info('Calculating category intelligence', { correlationId, outletId, dateFrom, dateTo });
      data = await getAnalytics().getCategoryIntelligence(outletId, dateFrom, dateTo);
      await getCache().set(cacheKey, data, { ttl: 7200 }); // 2h cache
    }

    return res.status(200).json({
      data,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in category-intelligence', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

export default router;
