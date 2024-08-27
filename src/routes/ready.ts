import { FastifyPluginAsync } from 'fastify';

const readinessProbe: FastifyPluginAsync = async (server) => {
  server.get(
    '/ready',
    {
      logLevel: 'warn',
    },
    async (req, res) => {
      res.status(200).send('OK');
    },
  );
};

export default readinessProbe;
