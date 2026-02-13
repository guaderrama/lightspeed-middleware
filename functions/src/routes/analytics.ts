import express from 'express';
import * as logger from 'firebase-functions/logger';
import { CacheService } from '../services/cache';
import { AnalyticsService } from '../services/analytics';
import { LightspeedClient } from '../services/lightspeed';
import { GeminiService } from '../services/gemini';
import { InventoryAnalysis } from '../types/analytics';

const router = express.Router();
const cache = new CacheService();
const lightspeedToken = process.env.LIGHTSPEED_PERSONAL_TOKEN || '';
const analytics = new AnalyticsService(lightspeedToken);
const lightspeedClient = new LightspeedClient(lightspeedToken);
const gemini = new GeminiService();

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

    let analysis = await cache.get<InventoryAnalysis>(cacheKey);
    const fromCache = !!analysis;

    if (!analysis) {
      logger.info('Cache miss - calculating REAL metrics', { correlationId, outletId });
      analysis = await analytics.calculateMetrics(outletId);
      await cache.set(cacheKey, analysis, { ttl: 21600 }); // 6h cache
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
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Error al obtener estado del inventario' },
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
    await cache.delete(cacheKey);
    const analysis = await analytics.calculateMetrics(outletId);
    await cache.set(cacheKey, analysis, { ttl: 21600 });

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
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Error al refrescar analisis' },
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

    let analysis = await cache.get<InventoryAnalysis>(cacheKey);
    if (!analysis) {
      logger.info('Cache miss - calculating metrics for low-stock', { correlationId });
      analysis = await analytics.calculateMetrics(outletId);
      await cache.set(cacheKey, analysis, { ttl: 21600 });
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
      error: { code: 'INTERNAL_ERROR', message: error.message || 'Error al obtener productos con stock bajo' },
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
    let outlets = await cache.get<any[]>('outlets-list');

    if (!outlets) {
      logger.info('Fetching outlets from Lightspeed', { correlationId });
      outlets = await lightspeedClient.listOutlets();
      await cache.set('outlets-list', outlets, { ttl: 3600 });
    }

    return res.status(200).json({
      data: outlets,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error fetching outlets', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message },
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
    let alerts = await cache.get<any>(alertsCacheKey);

    if (!alerts) {
      logger.info('Generating AI alerts', { correlationId, outletId });

      const analysisCacheKey = `inventory-analysis-${outletId}`;
      let analysis = await cache.get<InventoryAnalysis>(analysisCacheKey);
      if (!analysis) {
        analysis = await analytics.calculateMetrics(outletId);
        await cache.set(analysisCacheKey, analysis, { ttl: 21600 });
      }

      const salesContext = {
        total_products: analysis.metricas.length,
        critical_issues: analysis.recomendaciones.filter((r) => r.prioridad === 'alta').length,
        stockout_risk: analysis.listas_rapidas?.quiebres_inminentes?.length ?? 0,
        overstock: analysis.listas_rapidas?.sobrestock?.length ?? 0,
        slow_moving: analysis.listas_rapidas?.lenta_rotacion?.length ?? 0,
      };

      alerts = await gemini.forecastDemand(salesContext, {
        metricas_sample: analysis.metricas.slice(0, 20),
        recomendaciones: analysis.recomendaciones.slice(0, 15),
      });

      await cache.set(alertsCacheKey, alerts, { ttl: 1800 });
    }

    return res.status(200).json({
      data: alerts,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error generating alerts', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

export default router;
