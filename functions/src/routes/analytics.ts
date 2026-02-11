import express from 'express';
import * as logger from 'firebase-functions/logger';
import { CacheService } from '../services/cache';
import { AnalyticsService } from '../services/analytics';
import { LightspeedClient } from '../services/lightspeed';
import { GeminiService } from '../services/gemini';
import { InventoryAnalysis } from '../types/analytics';

const router = express.Router();
const cache = new CacheService();
const analytics = new AnalyticsService();
const lightspeedClient = new LightspeedClient(process.env.LIGHTSPEED_PERSONAL_TOKEN || '');
const gemini = new GeminiService();

/**
 * GET /analytics/inventory-status
 * Retorna análisis completo del inventario (con caché)
 */
router.get('/inventory-status', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';

  try {
    logger.info('Inventory status request', { correlationId });

    // Intentar obtener del caché
    let analysis = await cache.get('inventory-analysis');
    const fromCache = !!analysis;

    if (!analysis) {
      logger.info('Cache miss - calculating metrics', { correlationId });

      // Calcular métricas
      analysis = await analytics.calculateMetrics();

      // Guardar en caché por 6 horas
      await cache.set('inventory-analysis', analysis, { ttl: 21600 });
    }

    res.status(200).json({
      data: analysis,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId,
        fromCache,
        version: '1.0.0'
      }
    });
  } catch (error: any) {
    logger.error('Error fetching inventory status', {
      correlationId,
      error: error.message
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Error al obtener estado del inventario'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId
      }
    });
  }
});

/**
 * POST /analytics/refresh
 * Fuerza recalcular análisis (invalida caché)
 */
router.post('/refresh', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';

  try {
    logger.info('Force refresh requested', { correlationId });

    // Eliminar caché actual
    await cache.delete('inventory-analysis');

    // Recalcular
    const analysis = await analytics.calculateMetrics();

    // Guardar nuevo caché
    await cache.set('inventory-analysis', analysis, { ttl: 21600 });

    res.status(200).json({
      data: analysis,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId,
        refreshed: true,
        version: '1.0.0'
      }
    });
  } catch (error: any) {
    logger.error('Error refreshing analysis', {
      correlationId,
      error: error.message
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Error al refrescar análisis'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId
      }
    });
  }
});

/**
 * GET /analytics/low-stock
 * Retorna productos con stock bajo (por debajo del ROP o con cobertura < 14 días)
 */
router.get('/low-stock', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId || 'unknown';

  try {
    logger.info('Low stock request', { correlationId });

    // Intentar obtener del caché, si no recalcular
    let analysis = await cache.get<InventoryAnalysis>('inventory-analysis');

    if (!analysis) {
      logger.info('Cache miss - calculating metrics for low-stock', { correlationId });
      analysis = await analytics.calculateMetrics();
      await cache.set('inventory-analysis', analysis, { ttl: 21600 });
    }

    // Filtrar productos con stock bajo: bajo ROP o cobertura < 14 días
    const lowStockProducts = analysis.metricas.filter(
      (p) => p.stock_actual < p.rop || p.cobertura_dias < 14
    );

    // Obtener issues críticos relacionados con stock bajo
    const stockIssues = analysis.recomendaciones.filter(
      (r) => r.motivo === 'quiebre' || r.motivo === 'reabastecer'
    );

    res.status(200).json({
      data: {
        total: lowStockProducts.length,
        products: lowStockProducts,
        issues: stockIssues
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId,
        version: '1.0.0'
      }
    });
  } catch (error: any) {
    logger.error('Error fetching low stock', {
      correlationId,
      error: error.message
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Error al obtener productos con stock bajo'
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId
      }
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
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId,
        version: '2.0.0'
      }
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

  try {
    // Check cache first (30 min TTL)
    let alerts = await cache.get<any>('ai-alerts');

    if (!alerts) {
      logger.info('Generating AI alerts', { correlationId });

      // Get inventory analysis
      let analysis = await cache.get<InventoryAnalysis>('inventory-analysis');
      if (!analysis) {
        analysis = await analytics.calculateMetrics();
        await cache.set('inventory-analysis', analysis, { ttl: 21600 });
      }

      // Build quick sales summary from inventory data
      const salesContext = {
        total_products: analysis.metricas.length,
        critical_issues: analysis.recomendaciones.filter((r) => r.prioridad === 'alta').length,
        stockout_risk: analysis.listas_rapidas?.quiebres_inminentes?.length ?? 0,
        overstock: analysis.listas_rapidas?.sobrestock?.length ?? 0,
        slow_moving: analysis.listas_rapidas?.lenta_rotacion?.length ?? 0,
      };

      // Get AI forecast
      alerts = await gemini.forecastDemand(salesContext, {
        metricas_sample: analysis.metricas.slice(0, 20),
        recomendaciones: analysis.recomendaciones.slice(0, 15),
      });

      await cache.set('ai-alerts', alerts, { ttl: 1800 }); // 30 min cache
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
