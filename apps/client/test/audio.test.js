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
    events: [],
    value: 1,
    setValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; },
    setTargetAtTime(value) { this.value = value; this.events.push('target'); },
    cancelScheduledValues() { this.events.push('cancel'); },
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
    addEventListener() {}, removeEventListener() {},
    close() { this.state = 'closed'; return Promise.resolve(); },
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

describe('AudioManager lifecycle', () => {
  async function createAudio(t) {
    const oldWindow = globalThis.window;
    const oldDocument = globalThis.document;
    globalThis.window = new EventTarget();
    globalThis.document = new EventTarget();
    document.hidden = false;
    window.AudioContext = class { constructor() { return makeFakeContext(); } };
    const { AudioManager } = await import('../src/audio/AudioManager.js');
    const { settings } = await import('../src/core/SettingsStore.js');
    settings.set('soundEnabled', true);
    settings.set('masterVolume', 40);
    settings.set('musicVolume', 30);
    settings.set('sfxVolume', 20);
    settings.set('muteWhenUnfocused', true);
    const audio = new AudioManager();
    audio.init();
    t.after(() => {
      audio.dispose();
      globalThis.window = oldWindow;
      globalThis.document = oldDocument;
    });
    return { audio, settings };
  }

  test('initializes with persisted sound and volume settings', async t => {
    const { audio } = await createAudio(t);
    assert.equal(audio.soundEnabled, true);
    assert.equal(audio._masterGain.gain.value, 0.4);
    assert.equal(audio._sfxGain.gain.value, 0.2);
  });

  test('background mute silences SFX and restores the master gain', async t => {
    const { audio } = await createAudio(t);
    audio.toggleSound(true);
    audio.syncVolumesFromSettings();
    document.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(audio._canPlay(), false);
    assert.equal(audio._masterGain.gain.value, 0);
    document.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(audio._masterGain.gain.value, 0.4);
  });

  test('restarting BGM cancels an earlier fade-out', async t => {
    const { audio } = await createAudio(t);
    audio.toggleSound(true);
    audio.startBGM();
    audio.stopBGM(false);
    audio._bgmGain.gain.events.length = 0;
    audio.startBGM();
    assert.deepEqual(audio._bgmGain.gain.events.slice(-2), ['cancel', 'target']);
    assert.ok(audio.bgmNodes.length > 0);
  });

  test('sound settings update audio while only the menu is open', async t => {
    const { audio, settings } = await createAudio(t);
    audio.toggleSound(true);
    settings.set('soundEnabled', false);
    assert.equal(audio.soundEnabled, false);
    settings.set('soundEnabled', true);
    assert.equal(audio.soundEnabled, true);
  });

  test('latency reinitialization preserves muted menu music intent', async t => {
    const { audio, settings } = await createAudio(t);
    audio.startBGM();
    settings.set('soundEnabled', false);
    audio.reinit();
    settings.set('soundEnabled', true);
    assert.ok(audio.bgmNodes.length > 0);
  });
});
