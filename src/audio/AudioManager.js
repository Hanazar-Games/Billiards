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

const SFX_COOLDOWN_MS = 40; // min gap between identical SFX

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
    this._pendingBGMStart = false;
    this._lastUserGestureAt = -Infinity;
    this._gestureListenerOptions = { passive: true };
    this._masterVolume = 1.0;
    this._ambientVolume = 1.0;
    this._pendingDisconnects = new Set();
    this._disposing = false;
    this._settingsChangedHandler = null;
  }

  /** Disconnect a chain of audio nodes after the source finishes playing. */
  _autoDisconnect(source, ...nodes) {
    if (!source) return;
    const all = nodes.filter(Boolean);
    const doDisconnect = () => {
      if (this._disposing || !this.ctx) return; // AudioManager disposed — skip
      try {
        source.disconnect();
        all.forEach(n => n.disconnect());
      } catch (e) {}
    };
    if (source.onended !== undefined) {
      source.addEventListener('ended', doDisconnect);
    } else {
      // Fallback: estimate max duration and disconnect later
      if (this._disposing) return; // don't create new timers while disposing
      const tid = setTimeout(() => {
        this._pendingDisconnects.delete(tid);
        doDisconnect();
      }, 500);
      this._pendingDisconnects.add(tid);
    }
  }

  _safeVolumeScale(key) {
    const v = settings.get(key);
    return Math.min(Number.isFinite(v) && v >= 0 ? v : 1.0, 2.0);
  }

  init() {
    if (this.initialized) return;
    this._disposing = false;
    try {
      const latencyHint = settings.get('lowLatencyMode') ? 'interactive' : 'playback';
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

  /** Sync all persisted volume settings after init (or on settings import). */
  syncVolumesFromSettings() {
    if (!this.ctx || this.ctx.state === 'closed') return;
    const mv = settings.get('masterVolume');
    const music = settings.get('musicVolume');
    const sfx = settings.get('sfxVolume');
    const ambient = settings.get('ambientVolumeScale');
    if (Number.isFinite(mv)) this.setMasterVolume(mv);
    if (Number.isFinite(music)) this.setMusicVolume(music);
    if (Number.isFinite(sfx)) this.setSFXVolume(sfx);
    this.setAmbientVolume(Number.isFinite(ambient) ? ambient * 100 : 100);
  }

  /** Install global listeners for autoplay-policy resilience. */
  _installResilienceListeners() {
    if (!this.ctx) return;

    // Pre-emptively resume on any user gesture.  BGM start requests made
    // before the first gesture are deferred so browsers do not spam autoplay
    // warnings by attempting resume() from a non-gesture task.
    this._gestureHandler = () => {
      this._lastUserGestureAt = performance.now();
      this.resume();
      if (this._pendingBGMStart && this.soundEnabled) {
        this.startBGM();
      }
    };
    document.addEventListener('click', this._gestureHandler, this._gestureListenerOptions);
    document.addEventListener('keydown', this._gestureHandler, this._gestureListenerOptions);
    document.addEventListener('touchstart', this._gestureHandler, this._gestureListenerOptions);
    document.addEventListener('pointerdown', this._gestureHandler, this._gestureListenerOptions);

    // Pause BGM when tab is hidden to save battery (respect muteWhenUnfocused)
    this._visibilityHandler = () => {
      if (document.hidden) {
        this._bgmWasPlaying = this.bgmNodes.length > 0;
        if (settings.get('muteWhenUnfocused') !== false) {
          this.stopBGM();
        }
      } else if (this._bgmWasPlaying && this.soundEnabled) {
        this.startBGM();
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);

    // Auto-recover from browser-initiated suspension only when it follows a
    // recent user gesture; otherwise wait for the next gesture listener.
    this._stateHandler = () => {
      if (this.ctx && this.ctx.state === 'suspended' && this._hasRecentGesture()) {
        this.resume();
      }
      if (this.ctx && this.ctx.state === 'running' && this._pendingBGMStart && this.soundEnabled) {
        this.startBGM();
      }
    };
    this.ctx.addEventListener('statechange', this._stateHandler);

    // React to settings changes that affect audio routing
    this._settingsChangedHandler = (e) => {
      const key = e.detail?.key;
      if (key === 'muteWhenUnfocused') {
        // If just turned on and tab is hidden, stop BGM immediately
        if (settings.get('muteWhenUnfocused') !== false && document.hidden && this.bgmNodes.length > 0) {
          this._bgmWasPlaying = true;
          this.stopBGM();
        }
      }
      if (key === 'masterVolume' || key === 'musicVolume' || key === 'sfxVolume' || key === 'ambientVolumeScale' ||
          key === 'hitFeedbackVolumeScale' || key === 'cueHitVolumeScale' || key === 'collisionVolumeScale' ||
          key === 'pocketVolumeScale' || key === 'winVolumeScale' || key === 'foulVolumeScale') {
        this.syncVolumesFromSettings();
      }
    };
    window.addEventListener('settingsChanged', this._settingsChangedHandler);
  }

  _removeResilienceListeners() {
    if (this._gestureHandler) {
      document.removeEventListener('click', this._gestureHandler, this._gestureListenerOptions);
      document.removeEventListener('keydown', this._gestureHandler, this._gestureListenerOptions);
      document.removeEventListener('touchstart', this._gestureHandler, this._gestureListenerOptions);
      document.removeEventListener('pointerdown', this._gestureHandler, this._gestureListenerOptions);
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
    if (this._settingsChangedHandler) {
      window.removeEventListener('settingsChanged', this._settingsChangedHandler);
      this._settingsChangedHandler = null;
    }
  }

  toggleSound(enabled) {
    this.soundEnabled = Boolean(enabled);
    if (this._masterGain && this.ctx && this.ctx.state !== 'closed') {
      const v = enabled ? this._masterVolume : 0.0;
      this._masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
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
    if (!Number.isFinite(vol) || !this._masterGain || !this.ctx || this.ctx.state === 'closed') return;
    const v = Math.max(0, Math.min(1, vol / 100));
    this._masterVolume = v;
    // Respect the master mute switch: if sound is globally off, keep gain at 0
    const effectiveV = this.soundEnabled ? v : 0.0;
    this._masterGain.gain.setTargetAtTime(effectiveV, this.ctx.currentTime, 0.05);
  }

  setMusicVolume(vol) {
    if (!Number.isFinite(vol)) return;
    this._musicVolume = Math.max(0, Math.min(1, vol / 100));
    if (!this.ctx || this.ctx.state === 'closed') return;
    this._updateBGMVolume();
  }

  setAmbientVolume(vol) {
    if (!Number.isFinite(vol)) return;
    const v = Math.max(0, Math.min(1, vol / 100));
    this._ambientVolume = v;
    if (!this.ctx || this.ctx.state === 'closed') return;
    this._updateBGMVolume();
  }

  setSFXVolume(vol) {
    if (!Number.isFinite(vol)) return;
    this._sfxVolume = Math.max(0, Math.min(1, vol / 100));
    if (!this._sfxGain || !this.ctx || this.ctx.state === 'closed') return;
    this._sfxGain.gain.setTargetAtTime(this._sfxVolume, this.ctx.currentTime, 0.05);
  }

  _updateBGMVolume() {
    if (!this._bgmGain || !this.ctx || this.ctx.state === 'closed') return;
    const base = this._musicVolume;
    const ambient = this._ambientVolume;
    this._bgmGain.gain.setTargetAtTime(base * ambient, this.ctx.currentTime, 0.05);
  }

  _hasRecentGesture() {
    return performance.now() - this._lastUserGestureAt < 1200;
  }

  startBGM() {
    if (!this.enabled || !this.ctx || this.ctx.state === 'closed' || this.bgmNodes.length > 0 || !this.soundEnabled) return;
    if (this.ctx.state !== 'running' && !this._hasRecentGesture()) {
      this._pendingBGMStart = true;
      this._bgmWasPlaying = true;
      return;
    }
    this._pendingBGMStart = false;
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
    if (!this.ctx || this.ctx.state === 'closed') {
      this.bgmNodes = [];
      this._pendingBGMStart = false;
      if (!preserveFlag) this._bgmWasPlaying = false;
      return;
    }
    const t = this.ctx.currentTime;
    // Fade out BGM gain to avoid click/pop
    if (this._bgmGain && this._bgmGain.gain) {
      try {
        this._bgmGain.gain.cancelScheduledValues(t);
        this._bgmGain.gain.setValueAtTime(this._bgmGain.gain.value, t);
        this._bgmGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      } catch (e) {}
    }
    for (const node of this.bgmNodes) {
      try { if (node.stop) node.stop(t + 0.08); } catch (e) {}
      try { if (node.disconnect) node.disconnect(); } catch (e) {}
    }
    this.bgmNodes = [];
    this._pendingBGMStart = false;
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
    return this.enabled && this.ctx && this.ctx.state !== 'closed' && this.soundEnabled;
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
    if (!this._cooldown('cueHit')) return;
    this.resume();
    if (!Number.isFinite(power)) power = 50;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200 + Math.max(0, power) * 3, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);

    const feedbackScale = this._safeVolumeScale('hitFeedbackVolumeScale');
    const vol = (0.05 + Math.min(power / 100, 1) * 0.35) * this._safeVolumeScale('cueHitVolumeScale') * feedbackScale;
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
    if (!Number.isFinite(velocity)) velocity = 5;
    const intensity = Math.min(Math.max(0, velocity) / 20, 1);
    if (intensity < 0.05) return;
    if (!this._cooldown('ballCollision')) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600 + intensity * 400, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);

    // Non-linear volume curve: soft touches audible, hard hits punchy
    const vol = (0.05 + intensity * intensity * 0.12) * this._safeVolumeScale('collisionVolumeScale');
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06 + intensity * 0.04);

    osc.connect(gain);
    gain.connect(this._sfxGain || this._masterGain || this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
    this._autoDisconnect(osc, gain);
  }

  playCushionBounce(velocity = 5) {
    if (!Number.isFinite(velocity)) velocity = 5;
    if (!this._canPlay()) return;
    const intensity = Math.min(velocity / 15, 1);
    if (intensity < 0.05) return;
    if (!this._cooldown('cushionBounce')) return;
    this.resume();

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
    // Non-linear volume curve for more dynamic cushion feedback
    const vol = (0.06 + intensity * intensity * 0.14) * this._safeVolumeScale('collisionVolumeScale');
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08 + intensity * 0.04);

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
    gain.gain.setValueAtTime(0.2 * this._safeVolumeScale('pocketVolumeScale'), t);
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
    nGain.gain.setValueAtTime(0.08 * (settings.get('pocketVolumeScale') ?? 1.0), t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    noise.connect(nGain);
    nGain.connect(this._sfxGain || this._masterGain || this.ctx.destination);
    noise.start(t);
    this._autoDisconnect(noise, nGain);
  }

  playWin() {
    if (!this._canPlay()) return;
    if (!this._cooldown('win')) return;
    this.resume();

    // Brighter, shorter fanfare: C-E-G-C (upward arpeggio + decay)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const t = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18 * this._safeVolumeScale('winVolumeScale'), t + i * 0.08);
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
    if (!this._cooldown('foul')) return;
    this.resume();

    const t = this.ctx.currentTime;
    // Two short low "buzz" blips for distinct foul feedback
    [0, 0.12].forEach((offset) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, t + offset);
      osc.frequency.exponentialRampToValueAtTime(90, t + offset + 0.12);
      gain.gain.setValueAtTime(0.12 * this._safeVolumeScale('foulVolumeScale'), t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.14);
      osc.connect(gain);
      gain.connect(this._sfxGain || this._masterGain || this.ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.14);
      this._autoDisconnect(osc, gain);
    });
  }

  /** Re-create AudioContext so lowLatencyMode changes take effect immediately. */
  reinit() {
    if (!this.initialized) return;
    const wasPlaying = this.bgmNodes.length > 0;
    this.dispose();
    this.init();
    this.syncVolumesFromSettings();
    this.toggleSound(this.soundEnabled);
    if (wasPlaying && this.soundEnabled) {
      this.startBGM();
    }
  }

  dispose() {
    if (this._disposing) return;
    this._disposing = true;
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
    this._pendingBGMStart = false;
    this._bgmWasPlaying = false;
    this._lastUserGestureAt = -Infinity;
    for (const tid of this._pendingDisconnects) clearTimeout(tid);
    this._pendingDisconnects.clear();
    // Keep _disposing = true so async callbacks know we're done
  }
}
