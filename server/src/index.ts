import dotenv from 'dotenv';
import path from 'path';
// Load .env from root (server runs with CWD = /server, root .env is one level up)
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase, disconnectDatabase } from './engine/index.js';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/index.js';
import apiRouter from './routes/index.js';
import { API_PREFIX } from './constants/index.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function bootstrap() {
  await connectDatabase();

  const app = express();

  // Security & parsing middleware
  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // API routes
  app.use(API_PREFIX, apiRouter);

  // 404 & error handling (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = app.listen(PORT, () => {
    console.log(`[Server] Nexus Command API running on http://localhost:${PORT}`);
    console.log(`[Server] API available at http://localhost:${PORT}${API_PREFIX}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('[Server] Fatal startup error:', error);
  process.exit(1);
});
