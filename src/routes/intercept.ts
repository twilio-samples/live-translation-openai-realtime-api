import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { FastifyBaseLogger } from 'fastify';
import Twilio from 'twilio';

import AudioInterceptor from '@/services/AudioInterceptor';
import StreamSocket, { StartBaseAudioMessage } from '@/services/StreamSocket';

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
      const map =
        req.diScope.resolve<Map<string, AudioInterceptor>>('audioInterceptors');

      ss.onStart(async (message: StartBaseAudioMessage) => {
        const { customParameters } = message.start;

        if (
          customParameters?.direction === 'inbound' &&
          typeof customParameters.from === 'string'
        ) {
          ss.from = customParameters.from;
          const interceptor = new AudioInterceptor({
            logger,
            config: server.config,
            callerLanguage: customParameters.lang.toString(),
          });
          interceptor.inboundSocket = ss;
          map.set(customParameters.from, interceptor);
          logger.info(
            'Added inbound interceptor for %s with streamSid %s for callSid',
            customParameters.from,
            message.start.streamSid,
          );

          logger.info('Connecting to Agent');
          await twilio.calls.create({
            from: server.config.TWILIO_TRANSLATE_NUMBER,
            to: server.config.TWILIO_FLEX_NUMBER,
            callerId: customParameters.from,
            twiml: `
              <Response>
                <Say>A customer is on the line.</Say>
                <Connect>
                  <Stream name="Outbound Audio Stream" url="wss://${server.config.NGROK_DOMAIN}/intercept">
                    <Parameter name="direction" value="outbound"/>
                    <Parameter name="callSid" value="${message.start.callSid}"/>
                    <Parameter name="from" value="${customParameters.from}"/>
                  </Stream>
                </Connect>
              </Response>
            `,
          });
        }

        if (
          customParameters?.direction === 'outbound' &&
          typeof customParameters.from === 'string'
        ) {
          const interceptor = map.get(customParameters.from);
          ss.from = customParameters.from;
          if (!interceptor) {
            logger.error(
              'No inbound interceptor found for %s',
              customParameters.from,
            );
            return;
          }
          logger.info(
            'Added outbound interceptor with streamSid %s',
            message.start.streamSid,
          );
          interceptor.outboundSocket = ss;
        }
      });

      ss.onStop((message) => {
        if (!message?.from) {
          logger.info('No from in message - unknown what interceptor to close');
          return;
        }

        const interceptor = map.get(message.from);
        if (!interceptor) {
          logger.error('No interceptor found for %s', message.from);
          return;
        }

        logger.info('Closing interceptor');
        interceptor.close();
        map.delete(message.from);
      });
    },
  );
};

export default interceptWS;
