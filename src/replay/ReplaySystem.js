import { ReplayRecorder } from './ReplayRecorder.js';
import { ReplayLibrary } from './ReplayLibrary.js';

/**
 * ReplaySystem — High-level coordinator for all replay functionality.
 *
 * Responsibilities:
 *   - Automatically record every shot in Game.js (start at shoot, stop when balls stop)
 *   - Score each shot based on action/complexity and save to library
 *   - Provide API for MenuSystem to browse replays and enter playback mode
 */
export class ReplaySystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.library = new ReplayLibrary();
    this.recorder = new ReplayRecorder();
    this.currentShotScore = 0;
  }

  // ── Recording API (called by Game.js) ──

  /** Called when the player shoots the cue ball. */
  onShotStarted(mode, playerId, ballPositions, camera) {
    this.currentShotScore = 0;
    this.recorder.startRecording(mode, playerId, ballPositions, camera);
  }

  /** Called every frame during physics update. */
  onFrame(balls, camera) {
    this.recorder.recordFrame(balls, camera);
  }

  /** Called when a ball is pocketed. */
  onPocket(ballId, pocketPos, isCombo) {
    this.currentShotScore += isCombo ? 15 : 10;
    this.recorder.recordEvent('pocket', { ballId, pocketPos, isCombo });
  }

  /** Called when two balls collide. */
  onCollision(ballId, otherBallId, velocity, isCushion) {
    const bonus = isCushion ? 3 : 2;
    this.currentShotScore += bonus;
    this.recorder.recordEvent('collision', { ballId, otherBallId, velocity, isCushion });
  }

  /** Called when the shot ends (all balls stopped or turn resolved). */
  onShotEnded(metadata = {}) {
    const replayData = this.recorder.stopRecording();
    if (!replayData) return null;

    // Add scored metadata
    const enriched = {
      ...replayData,
      score: this.currentShotScore + (metadata.extraScore || 0),
      metadata: {
        ...metadata,
        collisionCount: replayData.collisionCount || 0,
        cushionCount: replayData.cushionCount || 0,
        pocketedIds: metadata.pocketedIds || [],
        duration: replayData.duration || 0,
      },
    };

    // Save to library
    const saved = this.library.save(enriched);
    return saved ? enriched : null;
  }

  // ── Library API (called by MenuSystem) ──

  getLibrary() {
    return this.library;
  }

  deleteReplay(id) {
    return this.library.delete(id);
  }

  clearLibrary() {
    this.library.clear();
  }

  // ── Lifecycle ──

  dispose() {
    this.recorder.stopRecording();
  }
}
