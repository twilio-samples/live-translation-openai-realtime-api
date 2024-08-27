import { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import { Type } from '@fastify/type-provider-typebox';

import AudioInterceptor from '@/services/AudioInterceptor';

const flexReservationAccepted: FastifyPluginAsync = async (server) => {
  server.post(
    '/reservation-accepted',
    {
      logLevel: 'info',
      schema: {
        body: Type.Object({
          EventType: Type.String(),
          AccountSid: Type.String(),
          WorkspaceSid: Type.String(),
          ResourceSid: Type.String(),
          TaskAttributes: Type.String(),
        }),
      },
    },
    async (req, res) => {
      const logger = req.diScope.resolve<FastifyBaseLogger>('logger');
      const map =
        req.diScope.resolve<Map<string, AudioInterceptor>>('audioInterceptors');

      const [, audioInterceptor] = map.entries().next().value;
      if (!audioInterceptor) {
        logger.error('AudioInterceptor not found');
        return res.status(404).send('Not Found');
      }

      audioInterceptor.start();

      res.status(200).send('OK');
    },
  );
};

export default flexReservationAccepted;
