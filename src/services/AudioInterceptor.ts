import { FastifyBaseLogger } from 'fastify';
import WebSocket from 'ws';

import StreamSocket, { MediaBaseAudioMessage } from '@/services/StreamSocket';
import { Config } from '@/config';
import { AI_PROMPT_AGENT, AI_PROMPT_CALLER } from '@/prompts';

type AudioInterceptorOptions = {
  logger: FastifyBaseLogger;
  config: Config;
  callerLanguage: string;
};

type BufferedMessage = {
  message_id: string;
  first_audio_buffer_add_time?: number;
  vad_speech_stopped_time: number;
};

type OpenAIMessage = {
  event_id: string;
  first_audio_buffer_add_time?: number;
  vad_speech_stopped_time: number;
  type: string;
  delta: string;
};

export default class AudioInterceptor {
  private static instance: AudioInterceptor;

  private readonly logger: FastifyBaseLogger;

  private config: Config;

  private readonly callerLanguage?: string;

  #callerSocket?: StreamSocket;

  #agentSocket?: StreamSocket;

  #callerOpenAISocket?: WebSocket;

  #agentOpenAISocket?: WebSocket;

  #agentFirstAudioTime?: number;

  #callerMessages?: BufferedMessage[];

  #agentMessages?: BufferedMessage[];

  public constructor(options: AudioInterceptorOptions) {
    this.logger = options.logger;
    this.config = options.config;
    this.callerLanguage = options.callerLanguage;
    this.setupOpenAISockets();
  }

  /**
   * Closes the audio interceptor
   */
  public close() {
    if (this.#callerSocket) {
      this.#callerSocket.close();
      this.#callerSocket = null;
    }
    if (this.#agentSocket) {
      this.#agentSocket.close();
      this.#agentSocket = null;
    }
    if (this.#callerOpenAISocket) {
      this.#callerOpenAISocket.close();
    }
    if (this.#agentOpenAISocket) {
      this.#agentOpenAISocket.close();
    }

    const callerTime = this.reportOnSocketTimeToFirstAudioBufferAdd(
      this.#callerMessages,
    );
    this.logger.info(`callerAverageTimeToFirstAudioBufferAdd = ${callerTime}`);
    const agentTime = this.reportOnSocketTimeToFirstAudioBufferAdd(
      this.#agentMessages,
    );
    this.logger.info(`agentAverageTimeToFirstAudioBufferAdd = ${agentTime}`);
  }

  /**
   * Starts the audio interception
   */
  public start() {
    if (!this.#agentSocket || !this.#callerSocket) {
      this.logger.error('Both sockets are not set. Cannot start interception');
      return;
    }

    this.logger.info('Initiating the websocket to OpenAI Realtime S2S API');
    // Start Audio Interception
    this.logger.info('Both sockets are set. Starting interception');
    this.#callerSocket.onMedia(
      this.translateAndForwardCallerAudio.bind(this),
    );
    this.#agentSocket.onMedia(
      this.translateAndForwardAgentAudio.bind(this),
    );
  }

  private translateAndForwardAgentAudio(message: MediaBaseAudioMessage) {
    this.#callerSocket.send([message.media.payload]);
    // Wait for 1 second after the first time we hear audio from the agent
    // This ensures that we don't send beeps from Flex to OpenAI when the call
    // first connects
    const now = new Date().getTime();
    if (!this.#agentFirstAudioTime) {
      this.#agentFirstAudioTime = now;
    } else if (now - this.#agentFirstAudioTime >= 1000) {
      if (!this.#agentOpenAISocket) {
        this.logger.error('Agent OpenAI WebSocket is not available.');
        return;
      } else {
        this.forwardAudioToOpenAIForTranslation(
          this.#agentOpenAISocket,
          message.media.payload,
        );
      }
    }
  }

  private translateAndForwardCallerAudio(message: MediaBaseAudioMessage) {
    this.#agentSocket.send([message.media.payload]);
    if (!this.#callerOpenAISocket) {
      this.logger.error('Caller OpenAI WebSocket is not available.');
      return;
    }
    this.forwardAudioToOpenAIForTranslation(
      this.#callerOpenAISocket,
      message.media.payload,
    );
  }

  /**
   * Setup the WebSocket connection to OpenAI Realtime S2S API
   * @private
   */
  private setupOpenAISockets() {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime';
    const callerSocket = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${this.config.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      },
    });
    const agentSocket = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${this.config.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      },
    });
    const callerPrompt = AI_PROMPT_CALLER.replace(
      /\[CALLER_LANGUAGE\]/g,
      this.callerLanguage,
    );
    const agentPrompt = AI_PROMPT_AGENT.replace(
      /\[CALLER_LANGUAGE\]/g,
      this.callerLanguage,
    );

    // Store the WebSocket instances
    this.#callerOpenAISocket = callerSocket;
    this.#agentOpenAISocket = agentSocket;

    // Configure the Realtime AI Agents with new 'session.update' client event
    const callerConfigMsg = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: callerPrompt,
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        input_audio_transcription: {model: 'whisper-1'},
        turn_detection: {type: 'server_vad'},
        //Setting temperature to minimum allowed value to get deterministic translation results
        temperature: 0.6
      }
    }
    const agentConfigMsg = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: agentPrompt,
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        input_audio_transcription: {model: 'whisper-1'},
        turn_detection: {type: 'server_vad'},
        //Setting temperature to minimum allowed value to get deterministic translation results
        temperature: 0.6
      }
    }

    // Event listeners for when the connection is opened
    callerSocket.on('open', () => {
      this.logger.info('Caller webSocket connection to OpenAI is open now.');
      // Send the initial prompt/config message to OpenAI for the Translation Agent.
      this.sendMessageToOpenAI(callerSocket, callerConfigMsg);
      this.logger.info(
        callerConfigMsg,
        'Caller session has been configured with the following settings:',
      );
    });
    agentSocket.on('open', () => {
      this.logger.info('Agent webSocket connection to OpenAI is open now.');
      // Send the initial prompt/config message to OpenAI for the Translation Agent.
      this.sendMessageToOpenAI(agentSocket, agentConfigMsg);
      this.logger.info(
        agentConfigMsg,
        'Agent session has been configured with the following settings:',
      );
    });

    // Event listeners for when a message is received from the server
    callerSocket.on('message', (msg) => {
      this.logger.info(`Caller message from OpenAI: ${msg}`);
      const currentTime = new Date().getTime();
      const message = JSON.parse(msg) as OpenAIMessage;
      if (message.type === 'input_audio_buffer.speech_stopped') {
        if (!this.#callerMessages) {
          this.#callerMessages = [];
        }
        this.#callerMessages.push({
          message_id: message.event_id,
          vad_speech_stopped_time: currentTime,
        });
      }
      if (message.type === 'response.audio.delta') {
        // Handle an audio message from OpenAI, post translation
        this.logger.info('Received caller translation from OpenAI');
        if (
          !this.#callerMessages[this.#callerMessages.length - 1]
            .first_audio_buffer_add_time
        ) {
          this.#callerMessages[
            this.#callerMessages.length - 1
          ].first_audio_buffer_add_time = currentTime;
        }
        this.#agentSocket.send([message.delta]);
      }
    });
    agentSocket.on('message', (msg) => {
      this.logger.info(`Agent message from OpenAI: ${msg.toString()}`);
      const currentTime = new Date().getTime();
      const message = JSON.parse(msg) as OpenAIMessage;;
      if (message.type === 'input_audio_buffer.speech_stopped') {
        if (!this.#agentMessages) {
          this.#agentMessages = [];
        }
        this.#agentMessages.push({
          message_id: message.event_id,
          vad_speech_stopped_time: currentTime,
        });
      }
      if (message.type === 'response.audio.delta') {
        // Handle an audio message from OpenAI, post translation
        this.logger.info('Received agent translation from OpenAI');
        if (
          !this.#agentMessages[this.#agentMessages.length - 1]
            .first_audio_buffer_add_time
        ) {
          this.#agentMessages[
            this.#agentMessages.length - 1
          ].first_audio_buffer_add_time = currentTime;
        }
        this.#callerSocket.send([message.delta]);
      }
    });

    // Event listeners for when an error occurs
    callerSocket.on('error', (error: Error) => {
      this.logger.error('Caller webSocket error:', error);
    });
    agentSocket.on('error', (error: Error) => {
      this.logger.error('Agent webSocket error:', error);
    });

    // Event listeners for when the connection is closed
    callerSocket.on('close', () => {
      this.logger.info('Caller webSocket connection to OpenAI is closed now.');
    });

    agentSocket.on('close', () => {
      this.logger.info('Agent webSocket connection to OpenAI is closed now.');
    });
  }

  private reportOnSocketTimeToFirstAudioBufferAdd(messages: BufferedMessage[]) {
    const filtered = messages.filter(
      (message) => message.first_audio_buffer_add_time,
    );
    const totalTime = filtered.reduce(
      (acc, { first_audio_buffer_add_time, vad_speech_stopped_time }) =>
        acc + (first_audio_buffer_add_time - vad_speech_stopped_time),
      0,
    );

    return totalTime / filtered.length;
  }

  private forwardAudioToOpenAIForTranslation(socket: WebSocket, audio: String) {
    this.sendMessageToOpenAI(socket, {
      type: 'input_audio_buffer.append',
      audio: audio,
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

  get callerSocket(): StreamSocket {
    if (!this.#callerSocket) {
      throw new Error('Caller socket not set');
    }
    return this.#callerSocket;
  }

  set callerSocket(value: StreamSocket) {
    this.#callerSocket = value;
  }

  get agentSocket(): StreamSocket {
    if (!this.#agentSocket) {
      throw new Error('Agent socket not set');
    }
    return this.#agentSocket;
  }

  set agentSocket(value: StreamSocket) {
    this.#agentSocket = value;
  }
}
