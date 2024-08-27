import { FastifyBaseLogger } from 'fastify';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';

import StreamSocket, {
  MediaBaseAudioMessage,
  StartBaseAudioMessage,
} from '@/services/StreamSocket';
import { Config } from '@/config';

type AudioInterceptorOptions = {
  logger: FastifyBaseLogger;
  server: FastifyInstance;
};
export default class AudioInterceptor {
  private static instance: AudioInterceptor;

  private readonly logger: FastifyBaseLogger;

  private config: Config;

  private callSidFromAcceptedReservation: string | undefined;

  private callSidFromInboundMediaSocket: string | undefined;

  private callSidFromOutboundMediaSocket: string | undefined;

  private callerLanguage: string | undefined;

  #inboundSocket?: StreamSocket;

  #outboundSocket?: StreamSocket;

  private openAISocket?: WebSocket;

  messages = [];

  lastSpeaker = 'agent';

  private constructor(options: AudioInterceptorOptions) {
    this.logger = options.logger;
    this.config = options.server.config;

    this.setupOpenAISocket();
  }

  public static getInstance(
    options: AudioInterceptorOptions,
  ): AudioInterceptor {
    if (!AudioInterceptor.instance) {
      AudioInterceptor.instance = new AudioInterceptor(options);
    }
    return AudioInterceptor.instance;
  }

  public setCallSidFromAcceptedReservation(callSid: string): void {
    this.callSidFromAcceptedReservation = callSid;
    this.logger.info(`Call SID set to ${callSid} in AudioInterceptor`);
  }

  public setCallerLanguage(language: string): void {
    this.callerLanguage = language;
    this.logger.info(`Caller language set to ${language} in AudioInterceptor`);
  }

  public setMediaSocketCallSid(callSid: string, track: string): void {
    if (track === 'inbound') {
      this.callSidFromInboundMediaSocket = callSid;
    } else {
      this.callSidFromOutboundMediaSocket = callSid;
    }
  }

  public close() {
    if (this.#inboundSocket) {
      this.#inboundSocket.close();
      this.#inboundSocket = null;
    }
    if (this.#outboundSocket) {
      this.#outboundSocket.close();
      this.#outboundSocket = null;
    }
    if (this.openAISocket) {
      this.openAISocket.close();
    }
  }

  private start() {
    if (!this.#outboundSocket || !this.#inboundSocket) {
      return;
    }
    this.logger.info('Initiating the web socket to OpenAI Realtime S2S API');
    // Start Audio Interception
    this.logger.info('Both sockets are set. Starting interception');
    this.#inboundSocket.onMedia(
      this.translateAndForwardAudioToOutbound.bind(this),
    );
    this.#outboundSocket.onMedia(
      this.translateAndForwardAudioToInbound.bind(this),
    );
  }

  private translateAndForwardAudioToInbound(message: MediaBaseAudioMessage) {
    this.lastSpeaker = 'agent';
    this.logger.info(
      this.callSidFromAcceptedReservation,
      'this.callSidFromAcceptedReservation',
    );
    this.logger.info(
      this.callSidFromInboundMediaSocket,
      'this.callSidFromInboundMediaSocket',
    );
    if (
      this.callSidFromAcceptedReservation &&
      this.callSidFromOutboundMediaSocket ===
        this.callSidFromAcceptedReservation
    ) {
      // We have an accepted reservation, meaning
      this.logger.info(
        'WE HAVE A MATCH BETWEEN THE RESERVATION AND THE OUTBOUND MEDIA STREAM',
      );
    }

    /* if (this.openAISocket) {
      this.forwardAudioToOpenAIForTranslation(this.openAISocket, message.media.payload);
    } else {
      this.logger.error('OpenAI WebSocket is not available.');
    }
    // Need to figure out how to send the translated audio back to the inbound socket when the event comes from the OpenAI WebSocket
    // Looks like this can't be done synchronously. */
    this.#inboundSocket.send([message.media.payload]);
  }

  private translateAndForwardAudioToOutbound(message: MediaBaseAudioMessage) {
    this.lastSpeaker = 'client';
    /* if (this.openAISocket) {
      this.forwardAudioToOpenAIForTranslation(this.openAISocket, message.media.payload);
    } else {
      this.logger.error('OpenAI WebSocket is not available.');
    } */
    // Need to figure out how to send the translated audio back to the outbound socket when the event comes from the OpenAI WebSocket
    // Looks like this can't be done synchronously.
    this.#outboundSocket.send([message.media.payload]);
  }

  /**
   * Setup the WebSocket connection to OpenAI Realtime S2S API
   * @private
   */
  private setupOpenAISocket() {
    const url = 'wss://api.openai.com/v1/realtime';
    const socket = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${this.config.OPENAI_API_KEY}`,
      },
    });
    const open_ai_prompt = this.config.AI_AGENT_PROMPT.replace(/\[CALLER_LANGUAGE\]/g, this.callerLanguage);

    // Store the WebSocket instance
    this.openAISocket = socket;
    // Configure the Realtime AI Agent
    const configMsg = {
      event: 'set_inference_config',
      system_message: open_ai_prompt,
      turn_end_type: 'server_detection',
      voice: 'alloy',
      tool_choice: 'none',
      disable_audio: false,
      audio_format: 'g711-ulaw',
    };

    // Event listener for when the connection is opened
    socket.on('open', () => {
      this.logger.info('WebSocket connection to OpenAI is open now.');
      // Send the initial prompt/config message to OpenAI for the Translation Agent.
      this.sendMessageToOpenAI(socket, configMsg);
      this.logger.info(
        configMsg,
        'Session has been configured with the following settings:',
      );
    });

    // Event listener for when a message is received from the server
    socket.on('message', (data) => {
      this.logger.info(data.toString(), 'Message from OpenAI:');
      // Handle the incoming message here
      if (data.event === 'audio_buffer_add') {
        // Handle an audio message from OpenAI, post translation
        this.logger.info('Received translation from OpenAI');
        this.handleTranslatedAudioFromOpenAI(data);
      }
    });

    // Event listener for when an error occurs
    socket.on('error', (error) => {
      this.logger.error('WebSocket error:', error);
    });

    // Event listener for when the connection is closed
    socket.on('close', () => {
      this.logger.info('WebSocket connection to OpenAI is closed now.');
    });
  }

  private forwardAudioToOpenAIForTranslation(socket: WebSocket, audio: String) {
    this.sendMessageToOpenAI(socket, {
      event: 'audio_buffer_add',
      data: audio,
    });
  }

  private handleTranslatedAudioFromOpenAI(message: object) {
    if (this.lastSpeaker === 'agent') {
      this.#inboundSocket.send([message.data]);
    } else {
      // Last speaker is client
      this.#outboundSocket.send([message.data]);
    }
  }

  private sendMessageToOpenAI(socket: WebSocket, message: object) {
    if (socket.readyState === WebSocket.OPEN) {
      const jsonMessage = JSON.stringify(message);
      socket.send(jsonMessage);
    } else {
      this.logger.error('WebSocket is not open. Unable to send message.');
    }
  }

  get inboundSocket(): StreamSocket {
    if (!this.#inboundSocket) {
      throw new Error('Inbound socket not set');
    }
    return this.#inboundSocket;
  }

  set inboundSocket(value: StreamSocket) {
    this.#inboundSocket = value;
    this.start();
  }

  get outboundSocket(): StreamSocket {
    if (!this.#outboundSocket) {
      throw new Error('Outbound socket not set');
    }
    return this.#outboundSocket;
  }

  set outboundSocket(value: StreamSocket) {
    this.#outboundSocket = value;
    this.start();
  }
}
