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

     // Event listener for when the connection is opened
     socket.on('open', () => {
      this.logger.info('WebSocket connection to OpenAI is open now.');
      // You can send a message to the server here if needed
      // socket.send('Hello OpenAI!');
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
