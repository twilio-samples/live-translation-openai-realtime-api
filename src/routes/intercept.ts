import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { FastifyBaseLogger } from 'fastify';
import Twilio from 'twilio';

import AudioInterceptor from '@/services/AudioInterceptor';
import StreamSocket, { StartBaseAudioMessage } from '@/services/StreamSocket';

const map: Map<string, AudioInterceptor> = new Map();

const interceptWS: FastifyPluginAsyncTypebox = async (server) => {
  server.get(
    '/intercept',
    {
      websocket: true,
    },
    async (socket, req) => {
      const twilio = Twilio(
        server.config.TWILIO_ACCOUNT_SID,
        server.config.TWILIO_AUTH_TOKEN,
      );
      const logger = req.diScope.resolve<FastifyBaseLogger>('logger');
      const ss = new StreamSocket({
        logger,
        socket,
      });

      ss.onStart(async (message: StartBaseAudioMessage) => {
        const { customParameters } = message.start;

        if (
          customParameters?.direction === 'inbound' &&
          typeof customParameters.from === 'string'
        ) {
          const { callSid } = message.start;
          const interceptor = new AudioInterceptor({ logger, server });
          interceptor.inboundSocket = ss;
          map.set(callSid, interceptor);
          logger.info(
            'Added inbound interceptor for %s with streamSid %s',
            customParameters.from,
            message.start.streamSid,
          );

          logger.info('Connecting to Agent');
          await twilio.calls.create({
            from: server.config.TWILIO_TRANSLATE_NUMBER,
            to: server.config.TWILIO_FLEX_NUMBER,
            url: `https://${server.config.NGROK_DOMAIN}/outbound-call?CallSid=${callSid}`,
          });
        }

        if (
          customParameters?.direction === 'outbound' &&
          typeof customParameters.callSid === 'string'
        ) {
          const interceptor = map.get(customParameters.callSid);
          logger.info(
            'Added outbound interceptor with streamSid %s',
            message.start.streamSid,
          );
          interceptor.outboundSocket = ss;
        }
      });

      ss.onStop((message) => {
        if (map.has(message.stop.callSid)) {
          const interceptor = map.get(message.stop.callSid);
          interceptor.inboundSocket = undefined;
          interceptor.outboundSocket = undefined;
          map.delete(message.stop.callSid);
        }
      });
    },
  );
};

export default interceptWS;
