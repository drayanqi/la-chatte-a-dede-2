import Fastify, { type FastifyInstance } from 'fastify';
import { simulateRoutes } from './routes/simulate.js';
import { validateRoutes } from './routes/validate.js';

/**
 * Builds the Fastify application instance with all routes registered.
 * Kept separate from the entrypoint so tests can inject without binding a port.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(simulateRoutes);
  await app.register(validateRoutes);

  return app;
}
