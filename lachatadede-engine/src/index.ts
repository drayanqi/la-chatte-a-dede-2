import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(
    `invalid PORT env value ${JSON.stringify(process.env.PORT)}: expected an integer in [1, 65535]`,
  );
}

const app = await buildApp();

// Graceful shutdown: docker stop sends SIGTERM; finish closing the server
// (aborting in-flight requests) instead of being SIGKILLed mid-write.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void app.close().finally(() => process.exit(0));
  });
}

await app.listen({ port, host: '0.0.0.0' });
