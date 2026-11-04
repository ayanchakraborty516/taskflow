import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import env from './config/env.config.js';
import corsOptions from './config/cors.config.js';
import logger from './utils/logger.util.js';
import { NotFoundError } from './utils/api-error.util.js';
import errorMiddleware from './middlewares/error.middleware.js';
import apiRouter from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Security HTTP headers with modern CSP support
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Cross-Origin Resource Sharing
app.use(cors(corsOptions));

// HTTP Request logging
if (env.NODE_ENV !== 'test') {
  app.use(
    pinoHttp({
      logger,
      customLogLevel: (res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    })
  );
}

// Body and cookie parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Mount application API routes
app.use('/api', apiRouter);

// Serve static frontend assets in production if built
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));

  // SPA fallback for HTML5 client-side navigation
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

// Fallback 404 handler for unmatched API routes
app.use((req, res, next) => {
  next(new NotFoundError(`Endpoint ${req.method} ${req.originalUrl} not found`));
});

// Centralized error handling middleware
app.use(errorMiddleware);

export default app;
