import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
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
  private sampleBuffer: Uint8Array | null = null;
  private frameId: number | null = null;

  protected readonly isBrowser = signal(typeof window !== 'undefined');
  protected readonly isListening = signal(false);
  protected readonly isStarting = signal(false);
  protected readonly intensity = signal(0);
  protected readonly errorMessage = signal('');

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

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopListening();
    });
  }

  protected async toggleListening(): Promise<void> {
    if (this.isListening()) {
      this.stopListening();
      return;
    }

    await this.startListening();
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

    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;

    void this.audioContext?.close();
    this.audioContext = null;
  }
}
