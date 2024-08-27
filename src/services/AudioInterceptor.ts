import { FastifyBaseLogger } from 'fastify';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';

import StreamSocket, { MediaBaseAudioMessage } from '@/services/StreamSocket';

type AudioInterceptorOptions = {
  logger: FastifyBaseLogger;
  server: FastifyInstance;
};
export default class AudioInterceptor {
  private readonly logger: FastifyBaseLogger;
  private server: FastifyInstance;

  #inboundSocket?: StreamSocket;

  #outboundSocket?: StreamSocket;

  messages = [];

  public constructor(options: AudioInterceptorOptions) {
    this.logger = options.logger;
    this.server = options.server;
  }

  private start() {
    if (!this.#outboundSocket || !this.#inboundSocket) {
      return;
    }
    // Initiate the OpenAI S2S WebSocket connection
    this.initiateOpenAIS2SWebsocket();
    this.logger.info('Initiating the web socket to OpenAI Realtime S2S API');
    // Start Audio Interception
    this.logger.info('Both sockets are set. Starting interception');
    this.#inboundSocket.onMedia(this.onOutboundMedia.bind(this));
    this.#outboundSocket.onMedia(this.onInboundMedia.bind(this));
  }

  private onInboundMedia(message: MediaBaseAudioMessage) {
    this.#inboundSocket.send([message.media.payload]);
  }

  private onOutboundMedia(message: MediaBaseAudioMessage) {
    this.#outboundSocket.send([message.media.payload]);
  }

  private initiateOpenAIS2SWebsocket() {
    const url = 'wss://api.openai.com/v1/realtime';
    const socket = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${this.server.config.OPENAI_API_KEY}`
      }
    });

    // Configure the Realtime AI Agent
    const configMsg = {
      'event': 'set_inference_config',
      'system_message': 'You are a helpful assistant that tries to answer to customer questions. Be polite, precise and short in your answers.',
      'turn_end_type': 'server_detection',
      'voice': 'alloy',
      'tool_choice': 'none',
      'disable_audio': false,
      'audio_format': 'g711-ulaw',
    };

     // Event listener for when the connection is opened
     socket.on('open', () => {
      this.logger.info('WebSocket connection to OpenAI is open now.');
      // Send the initial prompt/config message to OpenAI for the Translation Agent.
      this.sendMessageToOpenAI(socket, configMsg);
    });

    // Event listener for when a message is received from the server
    socket.on('message', (data) => {
      this.logger.info('Message from OpenAI:', data.toString());
      // Handle the incoming message here
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
