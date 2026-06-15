import http from 'http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  await connectDB();
  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  // Without this, nodemon (or any rapid SIGINT/SIGTERM in dev) can leave an
  // orphan process holding the port, so the next start crashes with EADDRINUSE.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] received ${signal}, closing...`);
    server.close(() => {
      mongoose.disconnect().finally(() => process.exit(0));
    });
    // Hard exit fallback if close() hangs (e.g. open keep-alive connections).
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
}

bootstrap().catch((err) => {
  console.error('[fatal] failed to start', err);
  process.exit(1);
});
