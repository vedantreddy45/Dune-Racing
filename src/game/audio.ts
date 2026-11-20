import { RaceEvent } from '../game/types';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private muted = false;
  private active = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 0.35, this.ctx.currentTime, 0.03);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.35;
      this.masterGain.connect(this.ctx.destination);

      // Continuous subtle engine drone
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;

      this.engineSubOsc = this.ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.value = 28;

      this.engineOsc.connect(filter);
      this.engineSubOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc.start();
      this.engineSubOsc.start();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setEngineActive(isPlaying: boolean, speedRatio: number, isBoosting: boolean): void {
    this.active = isPlaying;
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.engineSubOsc) return;
    const now = this.ctx.currentTime;
    if (!isPlaying || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }
    const clamped = Math.max(0, Math.min(1.4, speedRatio));
    const baseFreq = 46 + clamped * 68 + (isBoosting ? 24 : 0);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.06);
    this.engineGain.gain.setTargetAtTime(0.055 + clamped * 0.045, now, 0.08);
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
  ): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    const jitter = 0.94 + Math.random() * 0.12;
    osc.frequency.setValueAtTime(freqStart * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd * jitter), now + duration);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public handleEvent(ev: RaceEvent): void {
    if (!this.ctx || this.muted) return;
    switch (ev.type) {
      case 'countdown':
        if (ev.value === 0) {
          this.playTone(880, 1174, 0.34, 'triangle', 0.28);
        } else {
          this.playTone(440, 420, 0.14, 'sine', 0.2);
        }
        break;
      case 'pickup':
        this.playTone(520, 980, 0.16, 'triangle', 0.22);
        break;
      case 'boostPad':
      case 'nitro':
      case 'magnet':
        this.playTone(210, 640, 0.28, 'sawtooth', 0.18);
        break;
      case 'shield':
        this.playTone(330, 660, 0.25, 'sine', 0.2);
        break;
      case 'shockwave':
        this.playTone(170, 48, 0.36, 'sawtooth', 0.32);
        break;
      case 'oilDrop':
        this.playTone(260, 140, 0.14, 'triangle', 0.15);
        break;
      case 'oilHit':
        this.playTone(340, 110, 0.3, 'square', 0.18);
        break;
      case 'collision':
        this.playTone(130, 52, 0.16, 'square', 0.2 * ev.intensity);
        break;
      case 'jump':
        this.playTone(190, 340, 0.16, 'sine', 0.14);
        break;
      case 'land':
        this.playTone(110, 48, 0.15, 'triangle', 0.18 * ev.intensity);
        break;
      case 'finish':
        this.playTone(523, 523, 0.12, 'triangle', 0.24);
        setTimeout(() => this.playTone(659, 659, 0.14, 'triangle', 0.24), 110);
        setTimeout(() => this.playTone(784, 1046, 0.38, 'triangle', 0.28), 220);
        break;
    }
  }

  public dispose(): void {
    if (this.active && this.engineGain && this.ctx) {
      this.engineGain.gain.value = 0;
    }
    this.engineOsc?.stop();
    this.engineSubOsc?.stop();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
