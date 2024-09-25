import 'dotenv/config';

import Ajv from 'ajv';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Static, Type } from '@fastify/type-provider-typebox';

export enum NodeEnv {
  development = 'development',
  test = 'test',
  production = 'production',
}

const ConfigSchema = Type.Strict(
  Type.Object({
    NODE_ENV: Type.Enum(NodeEnv),
    LOG_LEVEL: Type.String({ default: 'info' }),
    API_HOST: Type.String({ default: '0.0.0.0' }),
    API_PORT: Type.String({ default: '4040' }),
    NGROK_DOMAIN: Type.String(),
    TWILIO_ACCOUNT_SID: Type.String(),
    TWILIO_AUTH_TOKEN: Type.String(),
    TWILIO_CALLER_NUMBER: Type.String(),
    TWILIO_FLEX_NUMBER: Type.String(),
    TWILIO_FLEX_WORKFLOW_SID: Type.String(),
    OPENAI_API_KEY: Type.String(),
    FORWARD_AUDIO_BEFORE_TRANSLATION: Type.String({ default: 'false' }),
  }),
);

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: true,
  useDefaults: true,
  coerceTypes: true,
  allowUnionTypes: true,
});

export type Config = Static<typeof ConfigSchema>;

const configPlugin: FastifyPluginAsync = async (server) => {
  const validate = ajv.compile(ConfigSchema);
  const valid = validate(process.env);
  if (!valid) {
    throw new Error(
      `.env file validation failed - ${JSON.stringify(
        validate.errors,
        null,
        2,
      )}`,
    );
  }

  server.decorate('config', process.env as Config);
};

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

export default fp(configPlugin);
