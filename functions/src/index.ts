import * as logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import express from "express";
import { LightspeedClient } from "./lightspeed";

// This is the main Express app
const app = express();

// Define the secrets that the function needs to access
const secrets = [
  "LIGHTSPEED_PERSONAL_TOKEN",
  "BRIDGE_API_KEY",
];

// Initialize Lightspeed Client (will use process.env.LIGHTSPEED_PERSONAL_TOKEN)
const lightspeedClient = new LightspeedClient(process.env.LIGHTSPEED_PERSONAL_TOKEN || "");

// Middleware to check for the Bridge API Key
const requireApiKey = (
  req: express.Request, res: express.Response, next: express.NextFunction,
) => {
  logger.info(`[DEBUG] requireApiKey - req.path: ${req.path}`);
  // Allow public and test routes to pass without an API key
  if (req.path === "/testroute") {
    logger.info("[DEBUG] Bypassing API key check for test route.");
    return next();
  }
  if (req.path === "/health") {
    logger.info("[DEBUG] Bypassing API key check for health route.");
    return next();
  }

  const apiKey = process.env.BRIDGE_API_KEY;
  if (!apiKey) {
    logger.error("BRIDGE_API_KEY secret is not defined in the environment.");
    return res.status(500).json({error: "Server configuration error"});
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Unauthorized access attempt - Missing or invalid Authorization header", {path: req.path});
    return res.status(401).json({error: "Unauthorized"});
  }

  const providedKey = authHeader.split(" ")[1];
  if (providedKey === apiKey) {
    return next();
  } else {
    logger.warn("Unauthorized access attempt - Invalid API Key", {path: req.path});
    return res.status(401).json({error: "Unauthorized"});
  }
};

// Apply the API key middleware to all routes
app.use(requireApiKey);


// --- Public Routes ---

/**
 * /health
 * A public endpoint to check the operational status of the API.
 */
app.get("/health", (req: express.Request, res: express.Response) => {
  logger.info("Health check endpoint was called.");
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});


// --- Protected Routes ---

/**
 * /reports/sales-summary (DEBUGGING)
 * This endpoint is temporarily repurposed to return raw Lightspeed API response.
 */
app.get(
  "/reports/sales-summary",
  async (req: express.Request, res: express.Response) => {
    try {
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      const outletId = req.query.outlet_id as string;
      const includeReturns = req.query.include_returns === 'false' ? false : true; // Default to true

      if (!dateFrom || !dateTo || !outletId) {
        return res.status(400).json({ error: "Missing required query parameters: date_from, date_to, outlet_id" });
      }

      // Return the raw data from Lightspeed for debugging
      const rawData = await lightspeedClient.getSalesSummary(dateFrom, dateTo, outletId, includeReturns);
      return res.status(200).json(rawData);

    } catch (error: any) {
      logger.error("Error fetching sales summary:", { error: error.message, stack: error.stack, originalError: error });
      return res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

app.get(
  "/reports/sales-top",
  async (req: express.Request, res: express.Response) => {
    try {
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      const outletId = req.query.outlet_id as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      if (!dateFrom || !dateTo || !outletId) {
        return res.status(400).json({ error: "Missing required query parameters: date_from, date_to, outlet_id" });
      }

      const topProducts = await lightspeedClient.getTopSellingProducts(dateFrom, dateTo, outletId, limit);
      return res.status(200).json(topProducts);

    } catch (error: any) {
      logger.error("Error fetching top selling products:", { error: error.message, stack: error.stack, originalError: error });
      return res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

app.get(
  "/inventory/low-stock",
  (req: express.Request, res: express.Response) => {
    res.status(511).json({message: "Not Implemented Yet"});
  });


// --- Temporary Test Route ---
app.get("/testroute", async (req: express.Request, res: express.Response) => {
  const testOutletId = "0665b57a-9e6c-11ef-fec5-b1c46090d3de";
  const testDateFrom = "2025-08-01"; // Using a fixed recent date for testing
  const testDateTo = "2025-08-28";   // Using today's date for testing

  logger.info(`[TEST] Running sales-top test for outlet: ${testOutletId}`);

  try {
    const topProducts = await lightspeedClient.getTopSellingProducts(testDateFrom, testDateTo, testOutletId, 5);
    logger.info("[TEST] Successfully fetched and processed data:", {data: topProducts});
    res.status(200).json({
      message: "Test completed successfully. Check the Firebase emulator logs for the full result.",
      outletId: testOutletId,
      dateRange: { from: testDateFrom, to: testDateTo },
      result: topProducts,
    });
  } catch (error: any) {
    logger.error("[TEST] Error during sales-top test:", {
      errorMessage: error.message,
      stack: error.stack,
      outletId: testOutletId,
    });
    res.status(500).json({
      message: "Test failed. Check the Firebase emulator logs for details.",
      error: error.message,
    });
  }
});

// Apply the API key middleware to all routes
app.use(requireApiKey);


// --- Public Routes ---

/**
 * /health
 * A public endpoint to check the operational status of the API.
 */
app.get("/health", (req: express.Request, res: express.Response) => {
  logger.info("Health check endpoint was called.");
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});


// --- Protected Routes ---

/**
 * /reports/sales-summary (DEBUGGING)
 * This endpoint is temporarily repurposed to return raw Lightspeed API response.
 */
app.get(
  "/reports/sales-summary",
  async (req: express.Request, res: express.Response) => {
    try {
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      const outletId = req.query.outlet_id as string;
      const includeReturns = req.query.include_returns === 'false' ? false : true; // Default to true

      if (!dateFrom || !dateTo || !outletId) {
        return res.status(400).json({ error: "Missing required query parameters: date_from, date_to, outlet_id" });
      }

      // Return the raw data from Lightspeed for debugging
      const rawData = await lightspeedClient.getSalesSummary(dateFrom, dateTo, outletId, includeReturns);
      return res.status(200).json(rawData);

    } catch (error: any) {
      logger.error("Error fetching sales summary:", { error: error.message, stack: error.stack, originalError: error });
      return res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

app.get(
  "/reports/sales-top",
  async (req: express.Request, res: express.Response) => {
    try {
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      const outletId = req.query.outlet_id as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      if (!dateFrom || !dateTo || !outletId) {
        return res.status(400).json({ error: "Missing required query parameters: date_from, date_to, outlet_id" });
      }

      const topProducts = await lightspeedClient.getTopSellingProducts(dateFrom, dateTo, outletId, limit);
      return res.status(200).json(topProducts);

    } catch (error: any) {
      logger.error("Error fetching top selling products:", { error: error.message, stack: error.stack, originalError: error });
      return res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

app.get(
  "/inventory/low-stock",
  (req: express.Request, res: express.Response) => {
    res.status(511).json({message: "Not Implemented Yet"});
  });


// --- Export the API ---

// Expose the Express app as a single Cloud Function named "api".
export const api = onRequest({secrets}, app);