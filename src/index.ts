import server from './server';

process.on('unhandledRejection', (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

const port = +server.config.API_PORT;
const host = server.config.API_HOST;
await server.listen({ port, host });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close().then((err) => {
      // eslint-disable-next-line no-console
      console.log(`close application on ${signal}`);
      process.exit(err ? 1 : 0);
    });
  });
}
