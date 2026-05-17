/**
 * AudioManager — Unified Web Audio API manager for menu + game audio.
 *
 * Singleton pattern: MenuSystem owns the one instance and injects it
 * into every Game session. This prevents the Chrome ~6 AudioContext
 * limit from being exhausted.
 *
 * Lifecycle:
 *   - init()          : create AudioContext (requires user gesture)
 *   - toggleSound()   : master on/off switch
 *   - startBGM()      : ambient drone
 *   - stopBGM()       : silence background
 *   - dispose()       : close AudioContext, release all native resources
 *
 * Resilience:
 *   - Global click/keydown listeners pre-emptively resume() a suspended
 *     context so the first SFX after a cold load or tab-switch works.
 *   - visibilitychange pauses BGM in background tabs to save battery.
 *   - onstatechange auto-recovers from browser-initiated suspension.
 *   - Per-effect cooldowns prevent machine-gun distortion.
 */

import { settings } from '../core/SettingsStore.js';

const SFX_COOLDOWN_MS = 20; // min gap between identical SFX

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.initialized = false;
    this.bgmNodes = [];
    this.soundEnabled = false;
    this._masterGain = null;
    this._bgmGain = null;
    this._sfxGain = null;
    this._musicVolume = 1.0;
    this._sfxVolume = 1.0;
    this._lastSfxTime = new Map(); // sfxName -> timestamp
    this._visibilityHandler = null;
    this._gestureHandler = null;
    this._stateHandler = null;
    this._bgmWasPlaying = false;
    this._masterVolume = 1.0;
    this._ambientVolume = 1.0;
  }

  /** Disconnect a chain of audio nodes after the source finishes playing. */
  _autoDisconnect(source, ...nodes) {
    if (!source) return;
    const all = nodes.filter(Boolean);
    const doDisconnect = () => {
      if (!this.ctx) return; // AudioManager disposed — skip
      try {
        source.disconnect();
        all.forEach(n => n.disconnect());
      } catch (e) {}
    };
    if (source.onended !== undefined) {
      source.onended = doDisconnect;
    } else {
      // Fallback: estimate max duration and disconnect later
      setTimeout(doDisconnect, 5000);
    }
  }

  init() {
    if (this.initialized) return;
    try {
      const latencyHint = settings.get('lowLatencyMode') ? 'playback' : 'interactive';
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint });
      this._masterGain = this.ctx.createGain();
      this._masterGain.gain.value = 1.0;
      this._masterGain.connect(this.ctx.destination);

      this._bgmGain = this.ctx.createGain();
      this._bgmGain.gain.value = 1.0;
      this._bgmGain.connect(this._masterGain);

      this._sfxGain = this.ctx.createGain();
      this._sfxGain.gain.value = 1.0;
      this._sfxGain.connect(this._masterGain);
      this.enabled = true;
      this.initialized = true;
      this._installResilienceListeners();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  /** Install global listeners for autoplay-policy resilience. */
  _installResilienceListeners() {
    if (!this.ctx) return;

    // Pre-emptively resume on any user gesture
    this._gestureHandler = () => this.resume();
    document.addEventListener('click', this._gestureHandler, { once: true, passive: true });
    document.addEventListener('keydown', this._gestureHandler, { once: true, passive: true });
    document.addEventListener('touchstart', this._gestureHandler, { once: true, passive: true });

    // Pause BGM when tab is hidden to save battery
    this._visibilityHandler = () => {
      if (document.hidden) {
        this._bgmWasPlaying = this.bgmNodes.length > 0;
        this.stopBGM();
      } else if (this._bgmWasPlaying && this.soundEnabled) {
        this.startBGM();
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);

    // Auto-recover from browser-initiated suspension
    this._stateHandler = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.resume();
      }
    };
    this.ctx.addEventListener('statechange', this._stateHandler);
  }

  _removeResilienceListeners() {
    if (this._gestureHandler) {
      document.removeEventListener('click', this._gestureHandler);
      document.removeEventListener('keydown', this._gestureHandler);
      document.removeEventListener('touchstart', this._gestureHandler);
      this._gestureHandler = null;
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    if (this._stateHandler && this.ctx) {
      this.ctx.removeEventListener('statechange', this._stateHandler);
      this._stateHandler = null;
    }
  }

  toggleSound(enabled) {
    this.soundEnabled = enabled;
    if (this._masterGain) {
      const v = enabled ? (this._masterVolume ?? 1.0) : 0.0;
      this._masterGain.gain.setTargetAtTime(v, this.ctx?.currentTime ?? 0, 0.05);
    }
    // Stop BGM when sound is turned off to save CPU cycles;
    // visibilitychange will restart it when sound is re-enabled.
    if (!enabled) {
      this.stopBGM();
    } else if (this._bgmWasPlaying) {
      this.startBGM();
    }
  }

  setMasterVolume(vol) {
    if (!this._masterGain || !this.ctx) return;
    const v = Math.max(0, Math.min(1, vol / 100));
    this._masterVolume = v;
    this._masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  setMusicVolume(vol) {
    this._musicVolume = Math.max(0, Math.min(1, vol / 100));
    this._updateBGMVolume();
  }

  setSFXVolume(vol) {
    this._sfxVolume = Math.max(0, Math.min(1, vol / 100));
    if (!this._sfxGain || !this.ctx) return;
    this._sfxGain.gain.setTargetAtTime(this._sfxVolume, this.ctx.currentTime, 0.05);
  }

  setAmbientVolume(vol) {
    const v = Math.max(0, Math.min(1, vol));
    if (!this._bgmGain || !this.ctx) return;
    // Ambient sounds share the BGM gain chain; apply as a secondary multiplier
    this._ambientVolume = v;
    this._updateBGMVolume();
  }

  _updateBGMVolume() {
    if (!this._bgmGain || !this.ctx) return;
    const base = this._musicVolume ?? 1.0;
    const ambient = this._ambientVolume ?? 1.0;
    this._bgmGain.gain.setTargetAtTime(base * ambient, this.ctx.currentTime, 0.05);
  }

  startBGM() {
    if (!this.enabled || !this.ctx || this.ctx.state === 'closed' || this.bgmNodes.length > 0 || !this.soundEnabled) return;
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

      gain.gain.setValueAtTime(0.08, t);
      osc.connect(gain);
      gain.connect(this._bgmGain || this._masterGain || this.ctx.destination);
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
    noiseGain.gain.setValueAtTime(0.03, t);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this._bgmGain || this._masterGain || this.ctx.destination);
    noise.start(t);

    this.bgmNodes.push(noise, noiseFilter, noiseGain);
    this._bgmWasPlaying = true;
  }

  stopBGM(preserveFlag = true) {
    const t = this.ctx ? this.ctx.currentTime : 0;
    for (const node of this.bgmNodes) {
      try { if (node.stop) node.stop(t); } catch (e) {}
      try { if (node.disconnect) node.disconnect(); } catch (e) {}
    }
    this.bgmNodes = [];
    // When called from game entry (preserveFlag=false), reset the flag so
    // visibilitychange does not accidentally restart BGM while in-game.
    if (!preserveFlag) {
      this._bgmWasPlaying = false;
    }
  }

  resume() {
    if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
      this.ctx.resume().catch(() => {});
    }
  }

  _canPlay() {
    return this.enabled && this.ctx && this.soundEnabled;
  }

  /** Rate-limit rapid-fire identical SFX (collisions, cushion bounces). */
  _cooldown(name) {
    const now = performance.now();
    const last = this._lastSfxTime.get(name) ?? 0;
    if (now - last < SFX_COOLDOWN_MS) return false;
    this._lastSfxTime.set(name, now);
    return true;
  }

  playCueHit(power = 50) {
    if (!this._canPlay()) return;
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
    gain.connect(this._sfxGain || this._masterGain || this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
    this._autoDisconnect(osc, gain);
  }

  playBallCollision(velocity = 5) {
    if (!this._canPlay()) return;
    if (!this._cooldown('ballCollision')) return;
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
    gain.connect(this._sfxGain || this._masterGain || this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
    this._autoDisconnect(osc, gain);
  }

  playCushionBounce(velocity = 5) {
    if (!this._canPlay()) return;
    if (!this._cooldown('cushionBounce')) return;
    this.resume();

    const intensity = Math.min(velocity / 15, 1);
    if (intensity < 0.05) return;

    const t = this.ctx.currentTime;
    const bufferSize = Math.ceil(this.ctx.sampleRate * 0.08);
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
    gain.connect(this._sfxGain || this._masterGain || this.ctx.destination);
    noise.start(t);
    this._autoDisconnect(noise, filter, gain);
  }

  playPocket() {
    if (!this._canPlay()) return;
    if (!this._cooldown('pocket')) return;
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
    gain.connect(this._sfxGain || this._masterGain || this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
    this._autoDisconnect(osc, gain);

    const bufferSize = Math.ceil(this.ctx.sampleRate * 0.15);
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
    nGain.connect(this._sfxGain || this._masterGain || this.ctx.destination);
    noise.start(t);
    this._autoDisconnect(noise, nGain);
  }

  playWin() {
    if (!this._canPlay()) return;
    this.resume();

    // Brighter, shorter fanfare: C-E-G-C (upward arpeggio + decay)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const t = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.22);
      osc.connect(gain);
      gain.connect(this._sfxGain || this._masterGain || this.ctx.destination);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.22);
      this._autoDisconnect(osc, gain);
    });
  }

  playFoul() {
    if (!this._canPlay()) return;
    this.resume();

    const t = this.ctx.currentTime;
    // Two short low "buzz" blips for distinct foul feedback
    [0, 0.12].forEach((offset) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, t + offset);
      osc.frequency.exponentialRampToValueAtTime(90, t + offset + 0.12);
      gain.gain.setValueAtTime(0.12, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.14);
      osc.connect(gain);
      gain.connect(this._sfxGain || this._masterGain || this.ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.14);
      this._autoDisconnect(osc, gain);
    });
  }

  dispose() {
    this.stopBGM();
    this._removeResilienceListeners();

    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
      this.ctx = null;
    }
    this._masterGain = null;
    this._bgmGain = null;
    this._sfxGain = null;
    this.enabled = false;
    this.initialized = false;
    this._lastSfxTime.clear();
  }
}
