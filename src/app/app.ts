import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly destroyRef = inject(DestroyRef);

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private mediaStream: MediaStream | null = null;
  private speechRecognition: SpeechRecognition | null = null;
  private sampleBuffer: Uint8Array | null = null;
  private frameId: number | null = null;

  protected readonly isBrowser = signal(typeof window !== 'undefined');
  protected readonly isListening = signal(false);
  protected readonly isStarting = signal(false);
  protected readonly intensity = signal(0);
  protected readonly errorMessage = signal('');
  protected readonly finalTranscript = signal('');
  protected readonly interimTranscript = signal('');
  protected readonly transcript = computed(() => {
    const finalText = this.finalTranscript().trim();
    const interimText = this.interimTranscript().trim();
    if (!finalText && !interimText) {
      return '';
    }
    if (finalText && interimText) {
      return `${finalText} ${interimText}`.trim();
    }
    return finalText || interimText;
  });
  protected readonly isTranscribing = signal(false);
  protected readonly speechSupported = signal(false);
  protected readonly speechError = signal('');
  protected readonly copyStatus = signal<'idle' | 'copied'>('idle');

  @ViewChild('messageArea') private messageArea?: ElementRef<HTMLDivElement>;

  protected readonly messages = signal<ChatMessage[]>([
    {
      role: 'bot',
      text: 'Hello! I am Jarvis. How can I assist you today?',
      timestamp: new Date(),
    },
  ]);
  protected readonly isBotTyping = signal(false);
  protected readonly currentInput = signal('');

  protected readonly statusLabel = computed(() => {
    if (!this.isBrowser()) {
      return 'Waiting for browser audio APIs';
    }

    if (this.errorMessage()) {
      return this.errorMessage();
    }

    if (this.isStarting()) {
      return 'Connecting to microphone';
    }

    if (!this.isListening()) {
      return 'Microphone idle';
    }

    const currentLevel = this.intensity();
    if (currentLevel > 0.2) {
      return 'Voice detected';
    }

    return 'Listening';
  });

  protected readonly orbScale = computed(() => (1 + this.intensity() * 0.65).toFixed(3));
  protected readonly ringOpacity = computed(() => (0.25 + this.intensity() * 0.55).toFixed(3));
  protected readonly levelPercent = computed(() => Math.round(this.intensity() * 100));

  protected readonly waveformBars = computed(() => {
    const level = this.intensity();
    const barCount = 20;
    const bars: number[] = [];
    for (let i = 0; i < barCount; i++) {
      // Create a pseudo-wave pattern: bars near center are taller
      const centerDistance = Math.abs(i - barCount / 2) / (barCount / 2);
      const waveShape = 1 - centerDistance * 0.6;
      // Add deterministic variation per bar using sin
      const variation = 0.7 + 0.3 * Math.sin(i * 1.8 + level * 12);
      const height = Math.max(3, level * 36 * waveShape * variation);
      bars.push(Math.round(height));
    }
    return bars;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopListening();
    });

    if (this.isBrowser()) {
      const globalWindow = window as Window & {
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
        SpeechRecognition?: SpeechRecognitionConstructor;
      };

      this.speechSupported.set(
        Boolean(globalWindow.SpeechRecognition || globalWindow.webkitSpeechRecognition)
      );
    }
  }

  protected async toggleListening(): Promise<void> {
    if (this.isListening()) {
      this.stopListening();
      return;
    }

    await this.startListening();
  }

  protected async copyTranscript(): Promise<void> {
    const text = this.transcript();
    if (!text || !this.isBrowser() || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.copyStatus.set('copied');
      
      // Reset status after 2 seconds
      setTimeout(() => {
        this.copyStatus.set('idle');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy transcript:', err);
    }
  }

  protected updateInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.currentInput.set(target.value);
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendTextMessage();
    }
  }

  protected sendTextMessage(): void {
    const text = this.currentInput().trim();
    if (!text) return;

    this.addMessage('user', text);
    this.currentInput.set('');
    this.generateBotReply();
  }

  private addMessage(role: 'user' | 'bot', text: string): void {
    this.messages.update((msgs) => [
      ...msgs,
      {
        role,
        text,
        timestamp: new Date(),
      },
    ]);
    this.scrollToBottom();
  }

  private async generateBotReply(): Promise<void> {
    if (this.isBotTyping()) return;

    this.isBotTyping.set(true);
    this.scrollToBottom();

    // Simulate thinking delay
    const delay = 1000 + Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const replies = [
      "I've noted that. Is there anything else you'd like to discuss?",
      "That's interesting. Tell me more.",
      "I'm processing your request. One moment please.",
      "Understood. I'm here to help with any questions you have.",
      "System check complete. All functions operating normally.",
      "Fascinating perspective. How should we proceed?",
    ];
    const randomReply = replies[Math.floor(Math.random() * replies.length)];

    this.isBotTyping.set(false);
    this.addMessage('bot', randomReply);
  }

  private scrollToBottom(): void {
    // Small timeout to allow DOM to update with new message
    setTimeout(() => {
      if (this.messageArea) {
        const el = this.messageArea.nativeElement;
        el.scrollTo({
          top: el.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 50);
  }

  private async startListening(): Promise<void> {
    if (!this.isBrowser() || this.isStarting()) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorMessage.set('Microphone access is not supported in this browser');
      return;
    }

    this.errorMessage.set('');
    this.isStarting.set(true);

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.startSpeechRecognition();

      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.85;

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.source.connect(this.analyser);
      this.sampleBuffer = new Uint8Array(this.analyser.frequencyBinCount);

      this.isListening.set(true);
      this.readAudioLevel();
    } catch {
      this.errorMessage.set('Microphone permission was denied or unavailable');
      this.stopListening();
    } finally {
      this.isStarting.set(false);
    }
  }

  private readAudioLevel(): void {
    if (!this.analyser || !this.sampleBuffer) {
      return;
    }

    this.analyser.getByteTimeDomainData(this.sampleBuffer as Uint8Array<ArrayBuffer>);

    let sum = 0;
    for (const sample of this.sampleBuffer) {
      const normalized = (sample - 128) / 128;
      sum += normalized * normalized;
    }

    const rms = Math.sqrt(sum / this.sampleBuffer.length);
    const boostedLevel = Math.min(rms * 4.5, 1);
    const smoothedLevel = this.intensity() * 0.82 + boostedLevel * 0.18;
    this.intensity.set(smoothedLevel);

    this.frameId = window.requestAnimationFrame(() => this.readAudioLevel());
  }

  private stopListening(): void {
    if (this.frameId !== null && this.isBrowser()) {
      window.cancelAnimationFrame(this.frameId);
    }

    this.frameId = null;
    this.intensity.set(0);
    this.isStarting.set(false);
    this.isListening.set(false);

    this.source?.disconnect();
    this.source = null;

    this.analyser?.disconnect();
    this.analyser = null;
    this.sampleBuffer = null;

    this.stopSpeechRecognition();

    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;

    void this.audioContext?.close();
    this.audioContext = null;
  }

  private startSpeechRecognition(): void {
    if (!this.isBrowser()) {
      return;
    }

    const globalWindow = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
      SpeechRecognition?: SpeechRecognitionConstructor;
    };

    const RecognitionCtor = globalWindow.SpeechRecognition || globalWindow.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      this.speechSupported.set(false);
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      this.speechSupported.set(false);
      this.speechError.set('Speech recognition requires HTTPS or localhost');
      return;
    }

    this.speechSupported.set(true);
    this.speechError.set('');

    if (!this.speechRecognition) {
      this.speechRecognition = new RecognitionCtor();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onstart = () => {
        this.isTranscribing.set(true);
      };

      this.speechRecognition.onerror = (event: Event) => {
        this.isTranscribing.set(false);
        const errorEvent = event as { error?: string };
        this.speechError.set(errorEvent.error ? `Speech error: ${errorEvent.error}` : 'Speech error');
      };

      this.speechRecognition.onend = () => {
        this.isTranscribing.set(false);
        if (this.isListening()) {
          this.speechRecognition?.start();
        }
      };

      this.speechRecognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalText = '';
        let interimText = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript ?? '';
          if (result.isFinal) {
            finalText = `${finalText} ${transcript}`.trim();
          } else {
            interimText = `${interimText} ${transcript}`.trim();
          }
        }
        
        if (finalText) {
          this.addMessage('user', finalText);
          this.generateBotReply();
          this.finalTranscript.set('');
          this.interimTranscript.set('');
        } else {
          this.interimTranscript.set(interimText.trim());
        }
      };
    }

    this.finalTranscript.set('');
    this.interimTranscript.set('');
    this.speechRecognition.start();
  }

  private stopSpeechRecognition(): void {
    if (!this.speechRecognition) {
      return;
    }

    this.isTranscribing.set(false);
    this.speechError.set('');
    try {
      this.speechRecognition.stop();
    } catch {
      // ignore stop errors from invalid state
    }
  }
}
