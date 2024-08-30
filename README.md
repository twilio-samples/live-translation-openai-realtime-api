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
