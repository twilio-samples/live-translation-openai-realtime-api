import { diContainer, fastifyAwilixPlugin } from '@fastify/awilix';
import sensible from '@fastify/sensible';
import fastifyFormBody from '@fastify/formbody';
import ws from '@fastify/websocket';
import { asFunction, asValue } from 'awilix';
import fastify from 'fastify';
import pino from 'pino';

import config from '@/config';
import routes from '@/routes';
import AudioInterceptor from './services/AudioInterceptor';

const server = fastify({
  logger: {
    serializers: {
      error: pino.stdSerializers.err,
    },
    level: process.env.LOG_LEVEL,
    base: {
      stream: 'access',
    },
    formatters: {
      level: (_: string, number: number) => {
        const levelMapping = {
          10: 'trace',
          20: 'debug',
          30: 'info',
          40: 'warning',
          50: 'error',
          60: 'fatal',
        };
        // @ts-ignore
        return { level: levelMapping[number] || 'debug' };
      },
    },
  },
});

await server.register(config);
await server.register(fastifyAwilixPlugin, { strictBooleanEnforced: true });
await server.register(fastifyFormBody);
await server.register(sensible);
await server.register(ws);
await server.register(routes);

diContainer.register({
  audioInterceptors: asValue(new Map<string, AudioInterceptor>()),
  logger: asValue(server.log.child({ stream: 'app' })),
});

server.addHook('onRequest', (request, reply, done) => {
  request.diScope.register({
    logger: asFunction(() =>
      request.log.child({
        requestId: request.id,
        stream: 'app',
      }),
    ),
  });

  done();
});

export default server;
