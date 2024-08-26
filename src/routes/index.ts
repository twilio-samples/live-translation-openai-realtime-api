import type { FastifyInstance } from 'fastify';

import livenessProbe from './live';
import readinessProbe from './ready';

export default async function routes(server: FastifyInstance) {
  server.register(livenessProbe);
  server.register(readinessProbe);
}
