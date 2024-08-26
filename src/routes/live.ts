import { FastifyPluginAsync } from 'fastify';

const livenessProbe: FastifyPluginAsync = async (server) => {
  server.get(
    '/live',
    {
      logLevel: 'warn',
    },
    async (req, res) => {
      res.status(200).send('OK');
    },
  );
};

export default livenessProbe;
