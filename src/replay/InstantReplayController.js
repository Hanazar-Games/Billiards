import { ShotReplay } from './ShotReplay.js';
import { InstantReplayCamera } from './InstantReplayCamera.js';
import { InstantReplayUI } from './InstantReplayUI.js';
import { settings } from '../core/SettingsStore.js';

/**
 * InstantReplayController — Orchestrates cinematic instant replays.
 *
 * Wraps ShotReplay with:
 *   - State save/restore (balls + camera)
 *   - Multi-angle camera director
 *   - HUD overlay with progress and skip
 *   - Auto-trigger based on shot excitement score
 *
 * Usage:
 *   controller.start(replayData, { auto: true, onComplete: () => ... });
 *   controller.update(dt); // call every frame while active
 *   controller.skip();      // end early
 */
export class InstantReplayController {
  constructor(scene, camera, ballsManager) {
    this.scene = scene;
    this.camera = camera;
    this.ballsManager = ballsManager;

    this.replayEngine = new ShotReplay(scene, ballsManager);
    this.cameraDirector = new InstantReplayCamera(camera);
    this.ui = new InstantReplayUI();

    this.active = false;
    this._savedBallStates = [];
    this._savedCameraState = null;
    this._onComplete = null;
  }

  /** Start instant replay. Returns true if started. */
  start(replayData, { auto = false, onComplete = null } = {}) {
    if (this.active) return false;
    if (!replayData || !replayData.frames || replayData.frameCount < 3) return false;

    this.active = true;
    this._autoTriggered = auto;
    this._onComplete = onComplete;

    // Save state before modifying
    this._saveBallStates();
    this._saveCameraState();

    // Load replay data
    const loaded = this.replayEngine.load(replayData);
    if (!loaded) {
      this._restoreAndEnd();
      return false;
    }

    // Set slow-motion speed (default 0.5x)
    this.replayEngine.setSpeed(1);
    this.replayEngine.play();

    // Show HUD
    this.ui.show(() => this.skip());
    this.ui.setSpeedLabel(this.replayEngine.getSpeedLabel());

    // Wire callbacks
    this.replayEngine.onComplete = () => this._onReplayComplete();
    this.replayEngine.onProgress = (current, total) => {
      const ratio = total > 0 ? current / total : 0;
      this.ui.setProgress(ratio);
      this.cameraDirector.update(ratio, this.replayEngine.getDuration(), this.ballsManager);
    };

    return true;
  }

  /** Update replay playback. Call every frame with dt (seconds). */
  update(dt) {
    if (!this.active) return;

    const safeDt = Math.min(Number.isFinite(dt) ? dt : 0, 0.05);
    if (safeDt <= 0) return;

    this.replayEngine.update(safeDt);
    this.cameraDirector.update(
      this.replayEngine.getProgress(),
      this.replayEngine.getDuration(),
      this.ballsManager
    );
  }

  /** Skip the replay and restore game state immediately. */
  skip() {
    if (!this.active) return;
    this._endReplay();
  }

  _onReplayComplete() {
    if (!this.active) return;
    this._endReplay();
  }

  _endReplay() {
    if (!this.active) return;
    this.active = false;

    this.ui.hide();
    this.replayEngine.stop();
    this.cameraDirector.reset();

    this._restoreBallStates();
    this._restoreCameraState();

    const cb = this._onComplete;
    this._onComplete = null;
    if (cb) cb();
  }

  _restoreAndEnd() {
    this.active = false;
    this.ui.hide();
    this.replayEngine.stop();
    this._restoreBallStates();
    this._restoreCameraState();
  }

  /* ── State snapshots ── */

  _saveBallStates() {
    this._savedBallStates = [];
    if (!this.ballsManager || !this.ballsManager.balls) return;
    for (const ball of this.ballsManager.balls) {
      if (!ball) continue;
      this._savedBallStates.push({
        id: ball.id,
        position: ball.mesh
          ? { x: ball.mesh.position.x, y: ball.mesh.position.y, z: ball.mesh.position.z }
          : null,
        visible: ball.mesh ? ball.mesh.visible : false,
        pocketed: ball.pocketed,
      });
    }
  }

  _restoreBallStates() {
    if (!this.ballsManager || !this.ballsManager.balls) return;
    for (const state of this._savedBallStates) {
      const ball = this.ballsManager.balls.find((b) => b && b.id === state.id);
      if (!ball || !ball.mesh) continue;
      if (state.position) {
        ball.mesh.position.set(state.position.x, state.position.y, state.position.z);
      }
      ball.mesh.visible = state.visible;
      ball.pocketed = state.pocketed;
      // Sync physics body to prevent desync on next shot
      if (ball.body) {
        ball.body.position.set(
          ball.mesh.position.x,
          ball.mesh.position.y,
          ball.mesh.position.z
        );
        ball.body.velocity.set(0, 0, 0);
        ball.body.angularVelocity.set(0, 0, 0);
      }
    }
    this._savedBallStates = [];
  }

  _saveCameraState() {
    if (!this.camera) return;
    this._savedCameraState = {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      quaternion: {
        x: this.camera.quaternion.x,
        y: this.camera.quaternion.y,
        z: this.camera.quaternion.z,
        w: this.camera.quaternion.w,
      },
    };
  }

  _restoreCameraState() {
    if (!this.camera || !this._savedCameraState) return;
    const s = this._savedCameraState;
    this.camera.position.set(s.position.x, s.position.y, s.position.z);
    this.camera.quaternion.set(s.quaternion.x, s.quaternion.y, s.quaternion.z, s.quaternion.w);
    this._savedCameraState = null;
  }

  /* ── Helpers ── */

  /** Check if a replay should auto-trigger based on score threshold. */
  static shouldAutoTrigger(replayData) {
    if (!replayData) return false;
    if (settings.get('instantReplayEnabled') === false) return false;
    if (settings.get('autoInstantReplay') === false) return false;
    const threshold = settings.get('instantReplayThreshold') || 35;
    return (replayData.score || 0) >= threshold;
  }

  /** Check if instant replay feature is enabled at all. */
  static isEnabled() {
    return settings.get('instantReplayEnabled') !== false;
  }

  dispose() {
    this._endReplay();
    this.ui.destroy();
    this.replayEngine = null;
    this.cameraDirector = null;
    this.ballsManager = null;
    this.camera = null;
    this.scene = null;
  }
}
