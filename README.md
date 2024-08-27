# Tweek RealTime Translation with AI Assistants

## Local Setup

1) Get invited to the `Tweek Project - RealTime Translator` or setup a Flex account yourself.
2) Clone the repository
3) `npm install`
4) `cp .env.sample .env` and update the parameters. The sample file has all the `Tweek Project - RealTime Translator` - you will only need the authToken and openAI Token

Then, run the dev server:
`npm run dev`
## Diagram

The eventual flow of the application is as follows. 
- In this diagram, `Voice/Studio` has colloquially been used to represent the Twilio Voice and Studio.
- The `Agent` represents the human agent who will be connected to the call via Twilio Flex.

```mermaid

sequenceDiagram
    actor Customer
    participant Voice/Studio
    participant Assistant
    participant S2S LLM
    actor Agent

    Customer->>Voice/Studio: Calls Number
    Voice/Studio->>Customer: Say "Welcome to Tweek RealTime Translation. Press 1 for English, 2 for Spanish, 3 for Hindi."
    Customer->>Voice/Studio: Press 1
    
    Voice/Studio->>Assistant: [HTTP] POST /incoming-call
    Assistant->>Voice/Studio: Initiate Media Stream 1
    Voice/Studio->>Client: Say "Please wait while we connect you to an agent (in language selected)"
    Voice/Studio->>Assistant: [WS] Establish Websocket Connection
    Assistant->>Voice/Studio: [HTTP] Call Agent
    Voice/Studio->>Agent: Incoming Task
    Voice/Studio->>Agent: [WS] Establish Websocket Connection

%%    Middleware App->>S2S LLM: Initiate Realtime Websocket with translation prompt
%%    Middleware App->>Voice/Studio: Initiate Call 2 (Programmatic)
%%    Voice/Studio->>Staff: Connect Call 2
%%    Voice/Studio->>Middleware App: Initiate Media Stream 2
%%    Middleware App->>Staff: Say "You are now connected. Go ahead"
%%    Middleware App->>Voice/Studio: Confirm ready for translation
%%    Voice/Studio->>Staff: Say "Hello, this call is being facilitated by an AI Agent so each of you can speak in your preferred language. One moment."
%%
%%    Client->>Voice/Studio: User 1 Speaks in [Hindi]
%%    Voice/Studio->>Middleware App: Stream to Middleware via Media Stream 1
%%    Middleware App->>S2S LLM: Send Audio to S2S (via Websocket)
%%    S2S LLM->>Middleware App: S2S Translation to English (Audio Output)
%%    Middleware App->>Voice/Studio: Stream Translated English Audio via Media Stream 2
%%
%%    Staff->>Voice/Studio: User 2 Speaks in [English]
%%    Voice/Studio->>Middleware App: Stream to Middleware via Media Stream 2
%%    Middleware App->>S2S LLM: Send Audio to S2S (via Websocket)
%%    S2S LLM->>Middleware App: S2S Translation to Hindi (Audio Output)
%%    Middleware App->>Voice/Studio: Stream Translated [Hindi] Audio via Media Stream 1
%%
%%    Voice/Studio->>Client: Conversation Continues
%%    Voice/Studio->>Staff: Conversation Continues
```

