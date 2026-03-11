import express from 'express';
import * as logger from 'firebase-functions/logger';
import { LightspeedClient } from '../services/lightspeed';
import { CacheService } from '../services/cache';
import { resolveOutletId } from '../utils/resolve-outlet';

const router = express.Router();

// Lazy initialization — secrets are only available inside the handler at runtime
let _cache: CacheService | null = null;
function getCache(): CacheService {
  if (!_cache) { _cache = new CacheService(); }
  return _cache;
}

let _lightspeedClient: LightspeedClient | null = null;
function getLightspeedClient(): LightspeedClient {
  if (!_lightspeedClient) {
    const token = process.env.LIGHTSPEED_PERSONAL_TOKEN || '';
    _lightspeedClient = new LightspeedClient(token);
  }
  return _lightspeedClient;
}

/**
 * GET /reports/sales-summary
 * Resumen de ventas por período y outlet
 */
router.get('/sales-summary', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id, include_returns } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    const includeReturns = include_returns !== 'false';
    const resolvedOutletId = await resolveOutletId(outlet_id as string, getCache(), getLightspeedClient());
    const rawData = await getLightspeedClient().getSalesSummary(
      date_from as string, date_to as string, resolvedOutletId, includeReturns
    );

    return res.status(200).json({
      data: rawData,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in sales-summary', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /reports/sales-top
 * Top N productos más vendidos por período y outlet
 */
router.get('/sales-top', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id, limit } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    const limitNum = limit ? parseInt(limit as string) : 10;
    const resolvedOutletId = await resolveOutletId(outlet_id as string, getCache(), getLightspeedClient());
    const topProducts = await getLightspeedClient().getTopSellingProducts(
      date_from as string, date_to as string, resolvedOutletId, limitNum
    );

    return res.status(200).json({
      data: topProducts,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in sales-top', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /reports/sales-comparison
 * Sales comparison with previous period
 * Includes daily breakdown and period-over-period metrics
 */
router.get('/sales-comparison', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    // Calculate previous period dates
    const currentFrom = new Date(date_from);
    const currentTo = new Date(date_to);
    const periodLength = currentTo.getTime() - currentFrom.getTime();

    // Ensure minimum 1-day period for comparison (handles same-day ranges like "today")
    const effectivePeriodLength = Math.max(periodLength, 86400000); // 1 day in ms
    const previousFrom = new Date(currentFrom.getTime() - effectivePeriodLength);
    const previousTo = new Date(currentFrom.getTime() - 1); // Day before current period

    logger.info('Sales comparison request', {
      correlationId,
      current: { from: date_from, to: date_to },
      previous: { from: previousFrom.toISOString(), to: previousTo.toISOString() }
    });

    // Resolve outlet ID
    const resolvedOutletId = await resolveOutletId(outlet_id as string, getCache(), getLightspeedClient());

    // Fetch data in parallel
    const [dailySales, currentSummary, previousSummary] = await Promise.all([
      getLightspeedClient().getDailySales(date_from, date_to, resolvedOutletId),
      getLightspeedClient().getSalesSummary(date_from, date_to, resolvedOutletId, true),
      getLightspeedClient().getSalesSummary(
        previousFrom.toISOString(),
        previousTo.toISOString(),
        resolvedOutletId,
        true
      ),
    ]);

    // Calculate percentage changes
    const calculateChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const comparison = {
      current: {
        period: { from: date_from, to: date_to },
        summary: currentSummary.totals,
      },
      previous: {
        period: { from: previousFrom.toISOString(), to: previousTo.toISOString() },
        summary: previousSummary.totals,
      },
      changes: {
        amount: calculateChange(currentSummary.totals.amount, previousSummary.totals.amount),
        tickets: calculateChange(currentSummary.totals.tickets, previousSummary.totals.tickets),
        avg_ticket: calculateChange(currentSummary.totals.avg_ticket, previousSummary.totals.avg_ticket),
      },
      daily_sales: dailySales,
    };

    return res.status(200).json({
      data: comparison,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in sales-comparison', { correlationId, error: error.message, stack: error.stack });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /reports/sales-hourly
 * Sales grouped by hour of day (0-23)
 */
router.get('/sales-hourly', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    const resolvedOutletId = await resolveOutletId(outlet_id as string, getCache(), getLightspeedClient());
    const data = await getLightspeedClient().getHourlySales(date_from, date_to, resolvedOutletId);

    return res.status(200).json({
      data,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in sales-hourly', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /reports/sales-weekday
 * Sales grouped by day of week
 */
router.get('/sales-weekday', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    const resolvedOutletId = await resolveOutletId(outlet_id as string, getCache(), getLightspeedClient());
    const data = await getLightspeedClient().getWeekdaySales(date_from, date_to, resolvedOutletId);

    return res.status(200).json({
      data,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in sales-weekday', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /reports/sales-category
 * Sales grouped by product/category (top 10)
 */
router.get('/sales-category', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id, limit } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    const limitNum = limit ? parseInt(limit as string) : 10;
    const resolvedOutletId = await resolveOutletId(outlet_id as string, getCache(), getLightspeedClient());
    const data = await getLightspeedClient().getCategorySales(date_from, date_to, resolvedOutletId, limitNum);

    return res.status(200).json({
      data,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in sales-category', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /reports/sales-monthly
 * Sales grouped by month
 */
router.get('/sales-monthly', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    const resolvedOutletId = await resolveOutletId(outlet_id as string, getCache(), getLightspeedClient());
    const data = await getLightspeedClient().getMonthlySales(date_from, date_to, resolvedOutletId);

    return res.status(200).json({
      data,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in sales-monthly', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

/**
 * GET /reports/seasonal-comparison
 * Year-over-year monthly comparison (current period vs same period last year)
 */
router.get('/seasonal-comparison', async (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  const { date_from, date_to, outlet_id } = req.query as any;

  try {
    if (!date_from || !date_to || !outlet_id) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters: date_from, date_to, outlet_id' },
        meta: { timestamp: new Date().toISOString(), requestId: correlationId }
      });
    }

    const resolvedOutletId = await resolveOutletId(outlet_id as string, getCache(), getLightspeedClient());

    // Calculate previous year dates
    const currentFrom = new Date(date_from);
    const currentTo = new Date(date_to);
    const prevFrom = new Date(currentFrom);
    prevFrom.setFullYear(prevFrom.getFullYear() - 1);
    const prevTo = new Date(currentTo);
    prevTo.setFullYear(prevTo.getFullYear() - 1);

    const prevFromStr = prevFrom.toISOString().substring(0, 10);
    const prevToStr = prevTo.toISOString().substring(0, 10);

    const currentYear = currentFrom.getFullYear();
    const previousYear = prevFrom.getFullYear();

    // Fetch both periods in parallel
    const [currentMonthly, previousMonthly] = await Promise.all([
      getLightspeedClient().getMonthlySales(date_from, date_to, resolvedOutletId),
      getLightspeedClient().getMonthlySales(prevFromStr, prevToStr, resolvedOutletId),
    ]);

    // Build comparison aligned by month
    const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const prevMap = new Map((previousMonthly || []).map((m: any) => {
      const monthNum = parseInt(m.month.split('-')[1]);
      return [monthNum, m];
    }));

    const comparison = (currentMonthly || []).map((m: any) => {
      const monthNum = parseInt(m.month.split('-')[1]);
      const prev = prevMap.get(monthNum);
      const prevAmount = prev?.amount ?? 0;
      const changePct = prevAmount > 0 ? ((m.amount - prevAmount) / prevAmount) * 100 : (m.amount > 0 ? 100 : 0);

      return {
        month: monthNum,
        month_name: MONTH_NAMES[monthNum - 1] || `M${monthNum}`,
        current_amount: m.amount,
        previous_amount: prevAmount,
        change_pct: Math.round(changePct * 10) / 10,
        current_tickets: m.tickets,
        previous_tickets: prev?.tickets ?? 0,
      };
    });

    const currentTotal = comparison.reduce((s: number, c: any) => s + c.current_amount, 0);
    const previousTotal = comparison.reduce((s: number, c: any) => s + c.previous_amount, 0);
    const yoyChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : (currentTotal > 0 ? 100 : 0);

    const bestMonth = comparison.length > 0
      ? comparison.reduce((best: any, c: any) => c.current_amount > best.current_amount ? c : best).month_name
      : '';
    const worstMonth = comparison.length > 0
      ? comparison.reduce((worst: any, c: any) => c.current_amount < worst.current_amount ? c : worst).month_name
      : '';

    return res.status(200).json({
      data: {
        current_year: { year: currentYear, months: currentMonthly },
        previous_year: { year: previousYear, months: previousMonthly },
        comparison,
        summary: {
          current_total: Math.round(currentTotal * 100) / 100,
          previous_total: Math.round(previousTotal * 100) / 100,
          yoy_change_pct: Math.round(yoyChange * 10) / 10,
          best_month: bestMonth,
          worst_month: worstMonth,
        },
      },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in seasonal-comparison', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

export default router;
