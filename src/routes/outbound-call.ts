import { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

const outboundCall: FastifyPluginAsync = async (server) => {
  server.post(
    '/outbound-call',
    {
      logLevel: 'info',
    },
    async (req, reply) => {
      const logger = req.diScope.resolve<FastifyBaseLogger>('logger');
      const response = new VoiceResponse();

      try {
        logger.info('Setting up media stream for outbound call...');
        response.say('A customer is on the line.');
        response
          .enqueue({
            workflowSid: server.config.TWILIO_FLEX_WORKFLOW_SID,
          })
          .task(`{ "name": "${req.body.Caller}", "type": "inbound" }`);

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
