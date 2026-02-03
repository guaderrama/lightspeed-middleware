import express from 'express';
import * as logger from 'firebase-functions/logger';
import { LightspeedClient } from '../services/lightspeed';

const router = express.Router();

const lightspeedClient = new LightspeedClient(process.env.LIGHTSPEED_PERSONAL_TOKEN || '');

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
    const rawData = await lightspeedClient.getSalesSummary(
      date_from as string, date_to as string, outlet_id as string, includeReturns
    );

    return res.status(200).json({
      data: rawData,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in sales-summary', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message },
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
    const topProducts = await lightspeedClient.getTopSellingProducts(
      date_from as string, date_to as string, outlet_id as string, limitNum
    );

    return res.status(200).json({
      data: topProducts,
      meta: { timestamp: new Date().toISOString(), requestId: correlationId, version: '2.0.0' }
    });
  } catch (error: any) {
    logger.error('Error in sales-top', { correlationId, error: error.message });
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: error.message },
      meta: { timestamp: new Date().toISOString(), requestId: correlationId }
    });
  }
});

export default router;
