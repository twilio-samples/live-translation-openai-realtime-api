import { FastifyBaseLogger } from 'fastify';

import StreamSocket, { MediaBaseAudioMessage } from '@/services/StreamSocket';

type AudioInterceptorOptions = {
  logger: FastifyBaseLogger;
};
export default class AudioInterceptor {
  private readonly logger: FastifyBaseLogger;

  #inboundSocket?: StreamSocket;

  #outboundSocket?: StreamSocket;

  messages = [];

  public constructor(options: AudioInterceptorOptions) {
    this.logger = options.logger;
  }

  private start() {
    if (!this.#outboundSocket || !this.#inboundSocket) {
      return;
    }

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
