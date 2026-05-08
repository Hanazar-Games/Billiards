export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.initialized = false;
    this.bgmNodes = [];
    this.bgmEnabled = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  toggleBGM(enabled) {
    this.bgmEnabled = enabled;
    if (enabled) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
  }

  startBGM() {
    if (!this.enabled || !this.ctx || this.bgmNodes.length > 0) return;
    this.resume();

    const t = this.ctx.currentTime;

    // Ambient drone: two low sine waves with slight detune
    const freqs = [55, 82.5]; // A1 + E2, warm room tone
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Slow vibrato
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.15 + i * 0.1;
      lfoGain.gain.value = 1.5;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(t);

      gain.gain.setValueAtTime(0.04, t);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);

      this.bgmNodes.push(osc, gain, lfo, lfoGain);
    });

    // Very quiet noise floor (air conditioning feel)
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 300;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.015, t);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(t);

    this.bgmNodes.push(noise, noiseFilter, noiseGain);
  }

  stopBGM() {
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const node of this.bgmNodes) {
      try {
        if (node.stop) node.stop(t);
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    }
    this.bgmNodes = [];
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCueHit(power = 0.5) {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200 + power * 3, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);

    const vol = 0.15 + Math.min(power / 100, 1) * 0.25;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  playBallCollision(velocity = 5) {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    const intensity = Math.min(velocity / 20, 1);
    if (intensity < 0.05) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600 + intensity * 400, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);

    gain.gain.setValueAtTime(intensity * 0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playCushionBounce(velocity = 5) {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    const intensity = Math.min(velocity / 15, 1);
    if (intensity < 0.05) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800 + intensity * 1000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(intensity * 0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(t);
  }

  playPocket() {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);

    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.08, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    noise.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(t);
  }

  playWin() {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    const notes = [523.25, 659.25, 783.99, 1046.50];
    const t = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, t + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + i * 0.12);
      osc.stop(t + i * 0.12 + 0.3);
    });
  }

  playFoul() {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.3);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  }
}
