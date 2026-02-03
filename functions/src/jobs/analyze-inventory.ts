import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { AnalyticsService } from '../services/analytics';
import { CacheService } from '../services/cache';
import { GeminiService } from '../services/gemini';

const analytics = new AnalyticsService();
const cache = new CacheService();
const gemini = new GeminiService();

/**
 * Background job que se ejecuta cada 6 horas
 * Calcula métricas de inventario y las guarda en caché
 */
export const analyzeInventoryJob = onSchedule({
  schedule: 'every 6 hours',  // 00:00, 06:00, 12:00, 18:00
  timeZone: 'America/Mazatlan',
  secrets: ['LIGHTSPEED_PERSONAL_TOKEN', 'GEMINI_API_KEY']
}, async (event) => {
  logger.info('Starting scheduled inventory analysis');

  try {
    // 1. Calcular métricas
    logger.info('Calculating inventory metrics');
    const analysis = await analytics.calculateMetrics();

    // 2. Detectar problemas críticos
    const criticalCount = analysis.recomendaciones.filter(
      r => r.prioridad === 'alta'
    ).length;

    logger.info('Metrics calculated', {
      totalProducts: analysis.metricas.length,
      criticalIssues: criticalCount,
      stockouts: analysis.listas_rapidas.quiebres_inminentes.length
    });

    // 3. Si hay problemas críticos nuevos, usar Gemini para análisis profundo
    if (criticalCount > 0 && gemini.isConfigured()) {
      logger.info('Critical issues detected, calling Gemini AI', {
        count: criticalCount
      });

      try {
        const aiInsights = await gemini.analyzeInventory(analysis);
        analysis.aiInsights = aiInsights;

        logger.info('Gemini analysis completed successfully');
      } catch (error: any) {
        logger.error('Gemini analysis failed', {
          error: error.message
        });
        // Continuar sin insights de IA
      }
    }

    // 4. Guardar en caché
    await cache.set('inventory-analysis', analysis, { ttl: 21600 });  // 6 horas

    logger.info('Inventory analysis completed and cached successfully', {
      expiresIn: '6 hours'
    });

    // 5. TODO: Enviar alertas si hay problemas críticos
    // await sendAlerts(analysis.listas_rapidas.quiebres_inminentes);

  } catch (error: any) {
    logger.error('Scheduled inventory analysis failed', {
      error: error.message,
      stack: error.stack
    });

    // No lanzar error para no afectar futuros schedules
  }
});
