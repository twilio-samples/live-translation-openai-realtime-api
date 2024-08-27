import { Type } from '@fastify/type-provider-typebox';
import { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

const outboundCall: FastifyPluginAsync = async (server) => {
  server.post(
    '/outbound-call',
    {
      logLevel: 'info',
      schema: {
        body: Type.Object({
          From: Type.String(),
          To: Type.String(),
        }),
        querystring: Type.Object({
          CallSid: Type.String(),
        }),
      },
    },
    async (req, reply) => {
      const logger = req.diScope.resolve<FastifyBaseLogger>('logger');
      const response = new VoiceResponse();

      try {
        logger.info('Setting up media stream for outbound call...');

        response.say('A customer is on the line.');
        const start = response.connect();
        const stream = start.stream({
          name: 'Outbound Audio Stream',
          url: `wss://${server.config.NGROK_DOMAIN}/intercept`,
        });
        stream.parameter({
          name: 'direction',
          value: 'outbound',
        });
        stream.parameter({
          name: 'callSid',
          value: req.query.CallSid,
        });

        logger.info('Sending TwiML response for outbound call...');
        reply.type('text/xml');
        reply.send(response.toString());
      } catch (error) {
        logger.error('Error creating Flex task:', { error });
        reply.status(500).send('Internal Server Error');
      }
    },
  );
};

export default outboundCall;
