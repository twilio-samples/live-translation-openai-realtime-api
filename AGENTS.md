# Live Voice Translation with Twilio & OpenAI Realtime

A middleware service that uses Twilio Voice, Studio, Flex, and TaskRouter together with the OpenAI Realtime API to provide bidirectional live voice translation between a caller and a contact center agent.

## Commands

```bash
# Install dependencies (requires Node v20.10.0+)
npm install

# Copy environment variables
cp .env.sample .env

# Run in development mode
npm run dev

# Expose webhooks locally (required — Media Streams must reach this server)
# Requires ngrok — install and authenticate at https://ngrok.com before running
ngrok http 5050
# Copy the Forwarding URL (e.g. https://abc123.ngrok.app) into NGROK_DOMAIN in .env
```

## Environment Variables

Copy `.env.sample` to `.env`. Never commit `.env`.

```bash
cp .env.sample .env
```

| Variable | Where to find | Format |
| -------- | ------------- | ------ |
| `TWILIO_ACCOUNT_SID` | [Console](https://console.twilio.com) homepage | Starts with `AC` |
| `TWILIO_AUTH_TOKEN` | Console homepage → click to reveal | 32-char string. Treat as a password. |
| `TWILIO_CALLER_NUMBER` | Console → Phone Numbers → Manage — the number **not** connected to Flex | E.164 format: `+15551234567` |
| `TWILIO_FLEX_NUMBER` | Console → Phone Numbers → Manage — the number auto-provisioned with your Flex account | E.164 format: `+15551234567` |
| `TWILIO_FLEX_WORKFLOW_SID` | Console → TaskRouter → Workspaces → Flex Task Assignment → Workflows | Starts with `WW` |
| `OPENAI_API_KEY` | [OpenAI API Keys](https://platform.openai.com/api-keys) | Starts with `sk-` |
| `NGROK_DOMAIN` | The Forwarding URL from `ngrok http 5050` — hostname only, no `https://` | `abc123.ngrok.app` |
| `API_PORT` | Optional. Port the local server listens on. | Default: `5050` |
| `FORWARD_AUDIO_BEFORE_TRANSLATION` | Optional. Set `true` in production to reduce perceived silence; leave `false` for local testing. | `false` |

## Project Structure

- `src/routes/incoming-call.ts` — handles inbound caller webhook from Studio; starts Media Stream to OpenAI
- `src/routes/flex-reservation-accepted.ts` — handles TaskRouter event when agent accepts; bridges both streams
- `src/routes/outbound-call.ts` — webhook for the Flex/agent-facing phone number
- `src/services/AudioInterceptor.ts` — intercepts Media Stream audio from both parties and routes through OpenAI
- `src/prompts.ts` — OpenAI Realtime prompts for caller and agent translation; edit here to change languages or behavior
- `inbound_language_studio_flow.json` — Studio Flow definition to import into Twilio Console

## Agent Boundaries

**Always:**
- Confirm `.env` is fully populated and ngrok is running before starting the server
- Walk the user through all three Twilio setup steps in order: (1) import Studio Flow, (2) point `TWILIO_CALLER_NUMBER` to the Studio Flow, (3) point `TWILIO_FLEX_NUMBER` and TaskRouter workspace to the middleware
- Remind the user that `NGROK_DOMAIN` must be updated every time a new ngrok session is started, and all three webhook URLs in Twilio Console must be updated to match
- Confirm the Flex Agent Desktop is open and agent status is set to **Available** before the user places a test call

**Never:**
- Run the app before the Twilio Console configuration is complete — the call flow will silently fail
- Use `TWILIO_FLEX_NUMBER` as the number to call when testing — calls must go to `TWILIO_CALLER_NUMBER`
- Hardcode credentials or phone numbers in source files

## Verify It's Working

1. Start the server with `npm run dev`, confirm it logs that it's listening on port 5050, then open the Flex Agent Desktop and set your status to **Available**
2. From a mobile phone, call the number in `TWILIO_CALLER_NUMBER` — select a language when prompted, and on the Flex Agent Desktop accept the incoming task; once connected, speak on either end and you should hear the translated audio delivered to the other party

## Twilio Resources

- [Twilio Console](https://console.twilio.com) — credentials, phone numbers, webhook configuration
- [Twilio Media Streams docs](https://www.twilio.com/docs/voice/media-streams)
- [Twilio Flex overview](https://www.twilio.com/docs/flex)
- [TaskRouter docs](https://www.twilio.com/docs/taskrouter)
