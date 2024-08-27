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
            TaskAttributes: Type.String()
        })  
      }
    },
    async (req, res) => {
      const logger = req.diScope.resolve<FastifyBaseLogger>('logger');
      const callSid = JSON.parse(req.body.TaskAttributes).call_sid;
      const callerLanguage = JSON.parse(req.body.TaskAttributes).caller_language;
      // Get the singleton instance and set the callSid
      const audioInterceptor = AudioInterceptor.getInstance({logger, server});
      audioInterceptor.setCallSidFromAcceptedReservation(callSid);
      audioInterceptor.setCallerLanguage(callerLanguage);
      res.status(200).send('OK');
    },
  );
};

export default flexReservationAccepted;