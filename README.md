#  Realtime AI Voice Translation with Twilio Flex & OpenAI
This application demonstrates how to use Twilio and OpenAI's Realtime API for bidirectional
voice language translation between a caller and a contact center agent.

The AI Assistant intercepts voice audio from one party, translates it, and speaks the audio in the other party's
preferred language. Use of the Realtime API from OpenAI offers significantly reduced latency that is conducive
to a natural two-way voice conversation.

See [here](https://www.loom.com/share/71498319660943638e1ef2c9928bcd2a) for a video demo of the real time translation app in action.

Below is a high level architecture diagram of how this application works:
![Realtime Translation Diagram](/realtime-voice-translation-app.jpeg)

This application uses the following Twilio products in conjuction with OpenAI's Realtime API, orchestrated by this middleware application:
- Voice
- Studio
- Flex
- Task Router

Two separate Voice calls are initiated, proxied by this middleware service. The caller is asked to choose their preferred language, then the conversation
is queued for the next available agent in Twilio Flex. Once connected to the agent, this middleware intercepts the audio from both parties via
[Media Streams](https://www.twilio.com/docs/voice/media-streams) and forwards to OpenAI Realtime for translation. The translated audio
is then forwarded to the other party.

## Prerequisites
To get up and running, you will need:
1. A Twilio Flex Account ([create](https://console.twilio.com/user/unified-account/details))
2. An OpenAI Account ([sign up](https://platform.openai.com/signup/)) and [API Key](https://platform.openai.com/api-keys)
3. A second Twilio phone number ([instructions](https://help.twilio.com/articles/223135247-How-to-Search-for-and-Buy-a-Twilio-Phone-Number-from-Console))
4. Node v20.10.0 or higher ([install](https://nodejs.org/en/download/package-manager))
5. Ngrok ([sign up](https://dashboard.ngrok.com/signup) and [download](https://ngrok.com/download))

## Local Setup

There are 3 required steps to get the app up-and-running locally for development and testing:
1. Open an ngrok tunnel
2. Configure middleware app
3. Twilio setup

### Open ngrok tunnel
When developing & testing locally, you'll need to open an ngrok tunnel that forwards requests to your local development server.
This ngrok tunnel is used for the Twilio Media Streams that forward call audio to/from this application.

To spin up an ngrok tunnel, open a Terminal and run:
```
ngrok http 5050
```
Once the tunnel has been initiated, copy the `Forwarding` URL. It will look something like: `https://[your-ngrok-domain].ngrok.app`. You will
need this when configuring environment variables for the middleware in the next section.

Note that the `ngrok` command above forwards to a development server running on port `5050`, which is the default port configured in this application. If
you override the `API_PORT` environment variable covered in the next section, you will need to update the `ngrok` command accordingly.

Keep in mind that each time you run the `ngrok http` command, a new URL will be created, and you'll need to update it everywhere it is referenced below.

### Configure middleware app locally
1) Clone this repository
2) Run `npm install` to install dependencies
3) Run `cp .env.sample .env` to create your local environment variables file

Once created, open `.env` in your code editor. You are required to set the following environment variables for the app to function properly:
| Variable Name     | Description                                      | Example Value          |
|-------------------|--------------------------------------------------|------------------------|
| `NGROK_DOMAIN` | The forwarding URL of your ngrok tunnel initiated above | `[your-ngrok-domain].ngrok.app` |
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID, which can be found in the Twilio Console. | `ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |
| `TWILIO_AUTH_TOKEN`  | Your Twilio Auth Token, which is also found in the Twilio Console.  | `your_auth_token_here`  |
| `TWILIO_CALLER_NUMBER`   | The additional Twilio phone number you purchased, **not** connected to Flex. Used for the caller-facing "leg" of the call. | `+18331234567` |
| `TWILIO_FLEX_NUMBER`   | The phone number automatically purchased when provisioning your Flex account. Used for the agent-facing "leg" of the call. | `+14151234567` |
| `TWILIO_FLEX_WORKFLOW_SID` | The Taskrouter Workflow SID, which is automatically provisioned with your Flex account. Used to enqueue inbound call with Flex agents. To find this, in the Twilio Console go to TaskRouter > Workspaces > Flex Task Assignment > Workflows  |`WWXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`|
| `OPENAI_API_KEY`              | Your OpenAI API Key             | `your_api_key_here`                 |

Below are optional environment variables that have default values that can be overridden:
| Variable Name     | Description                                      | Default Value          |
|-------------------|--------------------------------------------------|------------------------|
| `FORWARD_AUDIO_BEFORE_TRANSLATION` | Set to `true` to enable forwarding the original spoken audio between callers. For instance, if Caller is speaking Spanish, this would play the original Spanish audio for the Agent before the translated audio is played. This setting is useful in production contexts to minimize perceived silences. Not recommended for development mode where one person will be simultaneously playing the role of the caller and the agent.     | `false`                 |
| `API_PORT`        | The port your local server runs on.             | `5050`                 |

### Twilio setup

#### Import Studio Flow
You'll need to import the included Studio flow in the [inbound_language_studio_flow.json](inbound_language_studio_flow.json) file into your Twilio Account, then configure the caller-facing Twilio phone number to use this Flow. This Studio Flow will handle the initial inbound call, and present the caller with a basic IVR to select their preferred language to use in the conversation with the agent.

In the Twilio Console, go to the [Studio Flows](https://console.twilio.com/us1/develop/studio/flows?frameUrl=%2Fconsole%2Fstudio%2Fflows%3Fx-target-region%3Dus1) page and click **Create New Flow**. Give your Flow a name, like "Inbound Translation IVR", click Next, then select the option to **Import from JSON** and click Next.

Copy the contents of [inbound_language_studio_flow.json](inbound_language_studio_flow.json) and paste it into the textbox. Search for `[your-ngrok-domain]` and replace with your assigned ngrok tunnel domain. Click **Next** to import the Studio Flow, then **Publish**. 

The included Studio Flow will play a prerecorded message for the caller asking them to select their preferred language as either:
1. English
2. Spanish
3. French
4. Mandarin
5. Hindi

You can update the Studio Flow logic to change the languages you'd like to support. See [here](https://platform.openai.com/docs/guides/text-to-speech/supported-languages) for more information on OpenAI's supported language options. 

#### Point Caller Phone Number to Studio Flow
Once your Studio Flow is imported and published, the next step is to point your inbound / caller-facing phone number (`TWILIO_CALLER_NUMBER`) to your Studio Flow. In the Twilio Console, go to **Phone Numbers** > **Manage** > **Active Numbers** and click on the additional phone number you purchased (**not** the one auto-provisioned by Flex).

In your Phone Number configuration settings, update the first **A call comes in** dropdown to **Studio Flow**, select the name of the Flow you created above, and click **Save configuration**.
![Point Caller Phone Number to Studio Flow](https://github.com/user-attachments/assets/03faf925-ce72-43d9-ad36-2b25d769aac6)

#### Point Agent Phone Number and TaskRouter Workspace to Middleware
The last step is to point the agent-facing phone number (`TWILIO_FLEX_NUMBER`) and the TaskRouter "Flex Task Assignment" Workspace to this middleware app. This is needed to connect the conversation to a contact center agent in Flex.

In the Twilio Console, go to **Phone Numbers** > **Manage** > **Active Numbers** and click on Flex phone number that was auto-provisioned. In your Phone Number configuration settings, update the first **A call comes in** dropdown to **Webhook** and set the URL to `https://[your-ngrok-domain].ngrok.app/outbound-call`, ensure **HTTP** is set to **HTTP POST**, and click **Save configuration**.
![Point Agent Phone Number to Middleware](https://github.com/user-attachments/assets/dd14dc9e-635a-43fd-b2f9-7f8cd902ba61)

Ensure that you replace `[your-ngrok-domain]` with your assigned ngrok tunnel domain.

Then, go to **TaskRouter** > **Workspaces** > **Flex Task Assignment** > **Settings**, and set the **Event callback URL** to `https://[your-ngrok-domain].ngrok.app/reservation-accepted`, again replacing `[your-ngrok-domain]` with your assigned ngrok tunnel domain.

![Point TaskRouter Workspace to Middleware](https://github.com/user-attachments/assets/4fbeee03-6fb7-47a8-bc39-4b8abb9932cc)

Finally, under **Select events**, check the checkbox for **Reservation Accepted**.

![Select events > Reservation Accepted](https://github.com/user-attachments/assets/7745ca50-722c-453d-a175-af74bdb7f371)

### Run the app
Once dependencies are installed, `.env` is set up, and Twilio is configured properly, run the dev server with the following command:
```
npm run dev
```
### Testing the app
With the development server running, you may now begin to test the translation app. If you are wanting to test the app by yourself, simulating both the agent and the caller, we recommend setting `FORWARD_AUDIO_BEFORE_TRANSLATION` to `false` so you're not hearing duplicative audio.

To answer the call as the agent, you'll need log into the Flex Agent Desktop. The easiest way to do this is go to the [Flex Overview](https://console.twilio.com/us1/develop/flex/overview) page and click **Log in with Console**. Once the Agent Desktop is loaded, be sure that your Agent status is set to **Available** by toggling the dropdown in top-right corner of the window. This ensures enqueued tasks will be routed to you.

With your mobile phone, dial the `TWILIO_CALLER_NUMBER` and make a call (Do **not** dial the `TWILIO_FLEX_NUMBER`). You should hear a prompt to select your desired language, and then be connected to Flex. On the Flex Agent Desktop, once a language preference is selected, you should see the call appear as assigned to you. Use Flex to answer the call.

Once connected, you should now be able to speak on one end of the call, and hear the OpenAI translated audio delivered to the other end of the call (and vice-versa). By default, the Agent's language is set to English. The Realtime API will translate audio from the chosen caller language to English, and the agent's English speech to the chosen caller language.

## Sequence Diagram

The eventual flow of the application is as follows. 
- In this diagram, `Voice/Studio` has colloquially been used to represent the Twilio Voice and Studio.
- The `Agent` represents the human agent who will be connected to the call via Twilio Flex.

```mermaid
sequenceDiagram
    actor Customer
    participant Voice/Studio
    participant BMV
    participant S2S
    actor Agent

    Customer ->> Voice/Studio: Initiates Call
    Voice/Studio -->> Customer: <Say>Welcome to Be My Voice.<br>Your call will be transferred to an AI Assistant.<br>What language would you like to use?</Say><br><Gather ...>
    Customer -->> Voice/Studio: (Customer selects language)
    
    Voice/Studio ->> +BMV: [HTTP] POST /incoming-call
    BMV -->> -Voice/Studio: <Say>...</Say><br><Connect><Stream ... /></Connect>
    Voice/Studio -->> Customer: <Say>Please wait while we connect you.</Say>
    
    Customer ->> +BMV: [WS] Initiate Media Stream
    activate Customer
    activate BMV
    activate S2S
    BMV ->> +S2S: [WS] Establish Websocket Connection to OpenAI

    BMV ->> Voice/Studio: [HTTP] Create Call (to Agent)<br>with TwiML <Connect><Stream ... /></Connect>
    Voice/Studio -->> Agent: Incoming Task
    Agent ->> BMV: [WS] Establish Websocket Connection
    activate Agent
    Agent ->>+ BMV: [HTTP] Accept Task
    BMV -->>- Agent: Ok 200
    note right of BMV: BMV is now intercepting both <br>Agent and Customer Media Stream
    note right of BMV: For every Media that comes, stream the data to S2S<br>and stream the response back to Agent/Customer
    note right of BMV: For example, it may look something like
    
    loop A conversation loop
    Customer ->> BMV: [WS] (Speaks in their language)
    BMV ->> S2S: [WS] Stream audio in original language
    S2S -->> BMV: [WS] Audio stream in English
    BMV ->> Agent: [WS] Steam audio to Agent in English
    Agent -->> BMV: [WS] (Replies in English)
    BMV ->> S2S: [WS] Stream audio in English language
    S2S -->> BMV: [WS] Audio stream in original language
    BMV ->> Customer: [WS] Stream audio to Customer in original language
    end 


    note right of BMV: At some point, the conversation over<br>and the Customer hangs up
    BMV -->> Customer: [WS] Close
    deactivate Customer

    BMV -->> S2S: [WS] Close
    deactivate S2S
    BMV -->> Agent: [WS] Close
    deactivate BMV
    deactivate Agent
