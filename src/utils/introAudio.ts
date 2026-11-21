/**
 * F1 Audio Engine supporting authentic recorded Formula 1 engine audio files
 * (/audio/f1_real_rev.mp3, /audio/f1_engine_real.mp3, /audio/f1_flyby.mp3)
 * with instant preloading and Web Audio oscillator fallbacks.
 */

class IntroSoundEngine {
  private ctx: AudioContext | null = null;
  private revAudio: HTMLAudioElement | null = null;
  private launchAudio: HTMLAudioElement | null = null;
  private flybyAudio: HTMLAudioElement | null = null;
  private engineOsc: OscillatorNode | null = null;
  private turboOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initRealAudio();
    }
  }

  private initRealAudio() {
    try {
      this.revAudio = new Audio('/audio/f1_real_rev.mp3');
      this.revAudio.preload = 'auto';
      this.revAudio.volume = 0.85;

      this.launchAudio = new Audio('/audio/f1_engine_real.mp3');
      this.launchAudio.preload = 'auto';
      this.launchAudio.volume = 0.9;

      this.flybyAudio = new Audio('/audio/f1_flyby.mp3');
      this.flybyAudio.preload = 'auto';
      this.flybyAudio.volume = 0.8;
    } catch (e) {
      console.warn('Audio preloading failed:', e);
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Play real recorded F1 engine revs (rising RPM)
   */
  public playRealRev(playbackRate = 1.0) {
    if (this.revAudio) {
      try {
        this.revAudio.currentTime = 0;
        this.revAudio.playbackRate = playbackRate;
        const playPromise = this.revAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Fallback to synthesized engine if browser autoplay is constrained
            this.startEngine(6000);
          });
        }
        return;
      } catch {
        // Fallback
      }
    }
    this.startEngine(6000);
  }

  /**
   * Stop rev audio smoothly
   */
  public stopRealRev() {
    if (this.revAudio) {
      try {
        this.revAudio.pause();
        this.revAudio.currentTime = 0;
      } catch {}
    }
    this.stopEngine();
  }

  /**
   * Play real recorded F1 launch roar on Lights Out
   */
  public playRealLaunch() {
    this.stopRealRev();
    if (this.launchAudio) {
      try {
        this.launchAudio.currentTime = 0;
        this.launchAudio.playbackRate = 1.05;
        this.launchAudio.play().catch(() => {});
        return;
      } catch {}
    }
    this.playLaunchSnap();
  }

  /**
   * Play real recorded F1 high-speed track pass-by
   */
  public playRealFlyby() {
    if (this.flybyAudio) {
      try {
        this.flybyAudio.currentTime = 0;
        this.flybyAudio.play().catch(() => {});
        return;
      } catch {}
    }
    this.playFlyBy();
  }

  /**
   * Crisp FIA 5-red-lights countdown beep (1000 Hz sine burst)
   */
  public playFiaBeep(frequency = 960) {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  /**
   * High-tech telemetry data packet blip
   */
  public playTelemetryPing() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.11);
  }

  /**
   * Pit-to-car radio squelch static burst
   */
  public playRadioSquelch() {
    const ctx = this.getContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.14;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2200;
    bandpass.Q.value = 3.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }

  /**
   * Procedural synthesized engine fallback
   */
  public startEngine(rpm = 4000) {
    const ctx = this.getContext();
    if (!ctx) return;
    this.stopEngine();

    const fundamental = (rpm / 60) * 3;

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(fundamental, ctx.currentTime);

    this.turboOsc = ctx.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboOsc.frequency.setValueAtTime(fundamental * 12, ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(3200, fundamental * 8), ctx.currentTime);

    this.engineGain = ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.18, ctx.currentTime);

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);

    this.engineOsc.start();
  }

  public setRpm(rpm: number, duration = 0.4) {
    const ctx = this.getContext();
    if (!ctx || !this.engineOsc) return;

    const fundamental = (rpm / 60) * 3;
    const now = ctx.currentTime;

    this.engineOsc.frequency.cancelScheduledValues(now);
    this.engineOsc.frequency.linearRampToValueAtTime(fundamental, now + duration);
  }

  public stopEngine() {
    if (this.engineGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now);
        this.engineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        setTimeout(() => {
          this.engineOsc?.stop();
          this.engineOsc?.disconnect();
          this.engineOsc = null;
          this.engineGain = null;
        }, 160);
      } catch {
        this.engineOsc = null;
        this.engineGain = null;
      }
    }
  }

  public playLaunchSnap() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.setRpm(13000, 0.08);
    setTimeout(() => {
      this.stopEngine();
      this.playFlyBy();
    }, 350);
  }

  public playFlyBy() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    filter.type = 'bandpass';
    filter.Q.value = 5.0;

    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.6);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  }
}

export const introAudio = new IntroSoundEngine();
