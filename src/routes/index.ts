import type { FastifyInstance } from 'fastify';

import livenessProbe from './live';
import readinessProbe from './ready';
import incomingCall from './incoming-call';
import outboundCall from './outbound-call';
import interceptWS from './intercept';

export default async function routes(server: FastifyInstance) {
  server.register(livenessProbe);
  server.register(readinessProbe);
  server.register(incomingCall);
  server.register(outboundCall);
  server.register(interceptWS);
}
