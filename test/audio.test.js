import { test, describe } from 'node:test';
import assert from 'node:assert';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
}

function makeAudioParam() {
  return {
    value: 1,
    setValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; },
    setTargetAtTime(value) { this.value = value; },
    cancelScheduledValues() {},
  };
}

function makeNode(extra = {}) {
  return {
    connected: false,
    connect() { this.connected = true; },
    disconnect() {
      if (!this.connected) throw new Error('strict unconnected disconnect');
      this.connected = false;
    },
    start() {},
    stop() {},
    addEventListener() {},
    ...extra,
  };
}

function makeFakeContext() {
  return {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: makeNode(),
    createOscillator() {
      return makeNode({
        type: 'sine',
        frequency: makeAudioParam(),
      });
    },
    createGain() {
      return makeNode({ gain: makeAudioParam() });
    },
    createBuffer(_channels, size) {
      return {
        getChannelData() { return new Float32Array(size); },
      };
    },
    createBufferSource() {
      return makeNode({ buffer: null, loop: false });
    },
    createBiquadFilter() {
      return makeNode({
        type: 'lowpass',
        frequency: { value: 0 },
      });
    },
    resume() { return Promise.resolve(); },
  };
}

describe('AudioManager zero-volume safety', () => {
  test('zero-volume SFX paths do not throw on strict disconnect implementations', async () => {
    const { AudioManager } = await import('../src/audio/AudioManager.js');
    const { settings } = await import('../src/core/SettingsStore.js');

    settings.set('hitFeedbackVolumeScale', 0);
    settings.set('cueHitVolumeScale', 0);
    settings.set('collisionVolumeScale', 0);
    settings.set('pocketVolumeScale', 0);
    settings.set('winVolumeScale', 0);
    settings.set('foulVolumeScale', 0);

    const audio = new AudioManager();
    audio.ctx = makeFakeContext();
    audio.enabled = true;
    audio.soundEnabled = true;
    audio._masterGain = makeNode({ gain: makeAudioParam() });
    audio._sfxGain = makeNode({ gain: makeAudioParam() });

    assert.doesNotThrow(() => audio.playCueHit(60));
    assert.doesNotThrow(() => audio.playBallCollision(20));
    assert.doesNotThrow(() => audio.playCushionBounce(20));
    assert.doesNotThrow(() => audio.playPocket());
    assert.doesNotThrow(() => audio.playWin());
    assert.doesNotThrow(() => audio.playFoul());
  });
});
