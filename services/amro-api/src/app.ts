/**
 * Express Application Setup
 * Middleware and route initialization
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { authMiddleware } from './middleware/auth.middleware';
import workOrdersRoutes from './routes/work-orders.routes';
import { ErrorResponse } from './types/amro.types';
import { logger } from './utils/logger';
import { amroEventsProducer } from './events/amro-events.producer';

const app: Express = express();

function resolveContractsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'src/pages/api/v2/amro/contracts'),
    path.resolve(process.cwd(), '..', 'src/pages/api/v2/amro/contracts'),
    path.resolve(process.cwd(), '..', '..', 'src/pages/api/v2/amro/contracts'),
  ];
  const matched = candidates.find((candidate) => existsSync(candidate));
  if (!matched) {
    throw new Error('AMRO contract artifacts directory not found');
  }
  return matched;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Parse JSON bodies
app.use(express.json());

// CORS Configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  const startedAt = Date.now();
  res.setHeader('x-request-id', requestId);

  logger.info('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  res.on('finish', () => {
    logger.info('Request finished', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

// ============================================================================
// HEALTH CHECK ENDPOINTS
// ============================================================================

/**
 * GET /health
 * Service health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'amro-api',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /
 * Root endpoint
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'AMRO API Service',
    version: '0.1.0',
    description: 'Asset Maintenance, Repair, and Overhaul backend service',
  });
});

app.get('/api/v2/amro/contracts/:artifact', (req: Request, res: Response) => {
  const artifact = String(req.params.artifact || '').trim();
  const allowedArtifacts = new Set([
    'openapi-3.1.yaml',
    'asyncapi-2.6.yaml',
    'amro-v1.proto',
    'amro-subgraph.graphql',
  ]);
  if (!allowedArtifacts.has(artifact)) {
    res.status(404).json({
      error: 'Not Found',
      code: 'NOT_FOUND',
      statusCode: 404,
      path: req.path,
    } as ErrorResponse);
    return;
  }

  const contentTypeByArtifact: Record<string, string> = {
    'openapi-3.1.yaml': 'application/yaml; charset=utf-8',
    'asyncapi-2.6.yaml': 'application/yaml; charset=utf-8',
    'amro-v1.proto': 'application/protobuf; charset=utf-8',
    'amro-subgraph.graphql': 'application/graphql; charset=utf-8',
  };
  const contractsDir = resolveContractsDir();
  const filePath = path.join(contractsDir, artifact);
  const content = readFileSync(filePath, 'utf8');
  res.setHeader('Content-Type', contentTypeByArtifact[artifact] || 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(content);
});

app.get('/api/v2/amro/phase-plan', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'phase-plan',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/phase-1-readiness', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'phase-1-readiness',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/module-catalog', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'module-catalog',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/screen-inventory', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'screen-inventory',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/migration-plan', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'migration-plan',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

app.get('/api/v2/amro/health', (req: Request, res: Response) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  res.status(200).json({
    version: 'v2',
    mode: 'health',
    status: 'ok',
    requestId,
    domainAccess: {
      subscriptionStatus: 'public',
      source: 'public',
      validatedAt: new Date().toISOString(),
    },
  });
});

// ============================================================================
// PROTECTED API ROUTES
// ============================================================================

// Apply authentication middleware to all API routes
app.use('/api/v1', authMiddleware);
app.use('/api/v2/amro', authMiddleware);

// Mount work orders routes
app.use('/api/v1', workOrdersRoutes);
app.use('/api/v2', workOrdersRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * 404 Handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    statusCode: 404,
    path: req.path,
  } as ErrorResponse);
});

/**
 * Global Error Handler
 */
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  logger.error('Unhandled error', {
    requestId,
    method: req.method,
    path: req.path,
    message: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
  });

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    error: message,
    code,
    statusCode,
    requestId,
  } as ErrorResponse);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Setup graceful shutdown to disconnect Kafka producer
 */
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await amroEventsProducer.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await amroEventsProducer.shutdown();
  process.exit(0);
});

export default app;
