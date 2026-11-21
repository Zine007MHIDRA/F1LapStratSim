/**
 * Procedural Web Audio API sound synthesizer for F1 Simulator intro sequences.
 * Zero external audio files required - 100% generated in real-time.
 */

class IntroSoundEngine {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private turboOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

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
   * High-tech telemetry data packet blip (arpeggiated cyber ping)
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

    const bufferSize = ctx.sampleRate * 0.12;
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
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }

  /**
   * Start F1 engine sound at idle RPM (approx 4,000 RPM idle)
   */
  public startEngine(rpm = 4000) {
    const ctx = this.getContext();
    if (!ctx) return;
    this.stopEngine();

    const fundamental = (rpm / 60) * 3; // 3 cylinders firing per rev for V6 4-stroke

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(fundamental, ctx.currentTime);

    this.turboOsc = ctx.createOscillator();
    this.turboOsc.type = 'sine';
    this.turboOsc.frequency.setValueAtTime(fundamental * 12, ctx.currentTime);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(Math.min(3000, fundamental * 8), ctx.currentTime);
    this.filter.Q.value = 4.0;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.18, ctx.currentTime);

    const turboGain = ctx.createGain();
    turboGain.gain.setValueAtTime(0.04, ctx.currentTime);

    this.engineOsc.connect(this.filter);
    this.turboOsc.connect(turboGain);
    this.filter.connect(this.engineGain);
    turboGain.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);

    this.engineOsc.start();
    this.turboOsc.start();
  }

  /**
   * Ramp engine RPM smoothly to target RPM (e.g. 12,500 RPM rev limiter)
   */
  public setRpm(rpm: number, duration = 0.4) {
    const ctx = this.getContext();
    if (!ctx || !this.engineOsc || !this.turboOsc || !this.filter) return;

    const fundamental = (rpm / 60) * 3;
    const now = ctx.currentTime;

    this.engineOsc.frequency.cancelScheduledValues(now);
    this.engineOsc.frequency.linearRampToValueAtTime(fundamental, now + duration);

    this.turboOsc.frequency.cancelScheduledValues(now);
    this.turboOsc.frequency.linearRampToValueAtTime(fundamental * 14, now + duration);

    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.linearRampToValueAtTime(Math.min(5000, fundamental * 9), now + duration);
  }

  /**
   * Stop engine sound with smooth fade-out
   */
  public stopEngine() {
    if (this.engineGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now);
        this.engineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        setTimeout(() => {
          this.engineOsc?.stop();
          this.turboOsc?.stop();
          this.engineOsc?.disconnect();
          this.turboOsc?.disconnect();
          this.engineOsc = null;
          this.turboOsc = null;
          this.engineGain = null;
        }, 160);
      } catch {
        this.engineOsc = null;
        this.turboOsc = null;
        this.engineGain = null;
      }
    }
  }

  /**
   * Lights out / Launch throttle snap sound
   */
  public playLaunchSnap() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.setRpm(13000, 0.08);
    setTimeout(() => {
      this.stopEngine();
      // Re-trigger brief doppler flyby
      this.playFlyBy();
    }, 350);
  }

  /**
   * Doppler fly-by whoosh sound
   */
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

    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.6);

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
