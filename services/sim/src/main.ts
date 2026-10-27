// Entry point of the container: SIM_SECRET (required) and PORT (default 8080)
// come from the environment. One JSON line per request goes to stdout.
import type { AddressInfo } from 'node:net';
import { createSimServer } from './server.ts';

const secret = process.env.SIM_SECRET;
if (!secret) {
  console.error('SIM_SECRET is required');
  process.exitCode = 1;
} else {
  const server = createSimServer({ secret });
  // Prepended so the clock starts before the handler runs.
  server.prependListener('request', (req, res) => {
    const started = performance.now();
    res.on('finish', () => {
      const path = (req.url ?? '').split('?')[0];
      console.log(JSON.stringify({ path, status: res.statusCode, ms: Math.round(performance.now() - started) }));
    });
  });
  // All interfaces: the Nakama container reaches this one over the compose network (no port is published).
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => {
    console.log(JSON.stringify({ event: 'listening', port: (server.address() as AddressInfo).port }));
  });
  // As PID 1 in a container, Node ignores SIGTERM unless it has a handler.
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      server.close(() => process.exit(0));
      server.closeAllConnections();
    });
  }
}
