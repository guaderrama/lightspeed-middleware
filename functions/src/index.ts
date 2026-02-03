import * as logger from "firebase-functions/logger";
import {onRequest} from "firebase-functions/v2/https";
import express from "express";

// Import routes
import analyticsRoutes from "./routes/analytics";
import chatRoutes from "./routes/chat";
import reportsRoutes from "./routes/reports";

// Export background jobs
export { analyzeInventoryJob } from "./jobs/analyze-inventory";

// Define secrets needed
const secrets = [
  "LIGHTSPEED_PERSONAL_TOKEN",
  "BRIDGE_API_KEY",
];

// Initialize Express app
const app = express();
app.use(express.json());

// Authentication middleware
const requireApiKey = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const correlationId = req.headers['x-correlation-id'] as string ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  (req as any).correlationId = correlationId;

  logger.info("Authentication check", {
    correlationId,
    path: req.path,
    method: req.method
  });

  // Public routes
  const publicRoutes = ["/health", "/testroute"];
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  const apiKey = process.env.BRIDGE_API_KEY;
  if (!apiKey) {
    logger.error("BRIDGE_API_KEY not configured", { correlationId });
    return res.status(500).json({
      error: {
        code: "CONFIGURATION_ERROR",
        message: "Server configuration error"
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId
      }
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Missing or invalid Authorization header", { correlationId });
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header"
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId
      }
    });
  }

  const providedKey = authHeader.split(" ")[1];
  if (providedKey === apiKey) {
    return next();
  } else {
    logger.warn("Invalid API Key", { correlationId });
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid API key"
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: correlationId
      }
    });
  }
};

// Apply authentication middleware
app.use(requireApiKey);

// --- Routes ---

// Health check
app.get("/health", (req: express.Request, res: express.Response) => {
  const correlationId = (req as any).correlationId;
  logger.info("Health check", { correlationId });

  res.status(200).json({
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      uptime: process.uptime()
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: correlationId,
      version: "2.0.0"
    }
  });
});

// Mount route modules
app.use("/analytics", analyticsRoutes);
app.use("/chat", chatRoutes);
app.use("/reports", reportsRoutes);

// Export API
export const api = onRequest({secrets}, app);
