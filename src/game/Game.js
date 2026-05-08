import * as THREE from 'three';
import { Table } from './Table.js';
import { BallsManager } from './BallsManager.js';
import { InputHandler } from '../input/InputHandler.js';
import { Cue } from './Cue.js';
import { Rules } from './Rules.js';
import { UI } from '../ui/UI.js';
import { AudioManager } from '../audio/AudioManager.js';
import { SHOT, BALL } from '../config.js';

export class Game {
  constructor(renderer, physics) {
    this.renderer = renderer;
    this.physics = physics;
    this.scene = renderer.scene;
    this.camera = renderer.camera;

    this.table = null;
    this.ballsManager = null;
    this.input = null;
    this.cue = null;
    this.rules = new Rules();
    this.ui = new UI();
    this.audio = new AudioManager();

    this.state = 'AIM'; // AIM, CHARGING, SHOOTING, RESOLVING
    this.power = 0;
    this.charging = false;
    this.currentPlayer = 1;
    this.aimDirection = new THREE.Vector3(0, 0, 1);

    // Collision tracking for SFX and rules
    this.lastVelocities = new Map();
    this.ballCollisions = [];

    this._tmpVec2 = new THREE.Vector2();
    this._tmpVec3a = new THREE.Vector3();
    this._tmpVec3b = new THREE.Vector3();
    this._tmpVec3c = new THREE.Vector3();
  }

  async init() {
    this.audio.init();

    this.table = new Table(this.physics);
    this.table.addToScene(this.scene);

    this.ballsManager = new BallsManager(this.physics);
    this.ballsManager.createBalls();
    this.ballsManager.rackBalls();
    this.ballsManager.addToScene(this.scene);

    this.input = new InputHandler(this.renderer.renderer.domElement);
    this.input.onMouseMove = () => this.onMouseMove();
    this.input.onMouseDown = () => this.onMouseDown();
    this.input.onMouseUp = () => this.onMouseUp();

    this.cue = new Cue();
    this.scene.add(this.cue.mesh);

    this.ui.setPlayerTurn(1);
    this.ui.setMessage('Aim with mouse, hold LEFT CLICK to charge, release to shoot. RIGHT CLICK to rotate camera.');

    // Setup collision events
    this.setupCollisionEvents();

    this.ui.showResetButton(() => this.resetGame());
  }

  setupCollisionEvents() {
    for (const ball of this.ballsManager.balls) {
      ball.body.addEventListener('collide', (e) => {
        const otherBody = e.body === e.contact.bi ? e.contact.bj : e.contact.bi;
        const otherBall = this.ballsManager.balls.find(b => b.body === otherBody);

        const v = ball.body.velocity.length();

        if (otherBall) {
          // Ball-ball collision
          const relVel = Math.abs(v - otherBall.body.velocity.length());

          // First hit tracking (only for cue ball)
          if (ball.id === 0 && otherBall.id !== 0) {
            this.rules.recordFirstHit(otherBall.id);
          }

          if (relVel > 0.5) {
            this.audio.playBallCollision(relVel);
          }
        } else if (otherBody.material === this.physics.cushionMaterial) {
          // Ball-cushion collision
          if (v > 0.8) {
            this.audio.playCushionBounce(v);
          }
        }
      });
    }
  }

  onMouseMove() {
    if (this.state !== 'AIM' && this.state !== 'CHARGING') return;
    this.updateAimDirection();
  }

  onMouseDown() {
    if (this.state !== 'AIM') return;
    this.audio.resume(); // ensure audio context is active
    this.state = 'CHARGING';
    this.charging = true;
    this.power = 0;
  }

  onMouseUp() {
    if (this.state !== 'CHARGING') return;
    this.state = 'SHOOTING';
    this.charging = false;
    this.shoot();
  }

  updateAimDirection() {
    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall || cueBall.pocketed) return;

    const rect = this.renderer.renderer.domElement.getBoundingClientRect();
    this._tmpVec2.set(
      ((this.input.mouseX - rect.left) / rect.width) * 2 - 1,
      -((this.input.mouseY - rect.top) / rect.height) * 2 + 1
    );

    const ballPos = this._tmpVec3a.copy(cueBall.mesh.position);
    const cameraPos = this._tmpVec3b.copy(this.camera.position);

    const dir = this._tmpVec3c.set(this._tmpVec2.x, this._tmpVec2.y, 0.5)
      .unproject(this.camera)
      .sub(cameraPos)
      .normalize();

    const t = (ballPos.y - cameraPos.y) / dir.y;
    if (t <= 0 || !isFinite(t)) return;

    const hit = cameraPos.add(dir.multiplyScalar(t));
    const aim = new THREE.Vector3().subVectors(hit, ballPos);
    aim.y = 0;
    aim.normalize();

    if (aim.lengthSq() > 0.001) {
      this.aimDirection.copy(aim);
    }

    this.cue.setAim(ballPos, this.aimDirection);
  }

  shoot() {
    const cueBall = this.ballsManager.getCueBall();
    if (!cueBall) return;

    const force = Math.max(this.power, SHOT.minPower);
    cueBall.applyImpulse(
      this.aimDirection.x * force,
      0,
      this.aimDirection.z * force
    );

    this.audio.playCueHit(force);
    this.cue.hide();

    // Start tracking shot
    this.rules.startShot(this.currentPlayer);
  }

  update(dt) {
    if (this.charging) {
      this.power = Math.min(this.power + SHOT.chargeRate * dt, SHOT.maxPower);
      this.ui.setPower((this.power / SHOT.maxPower) * 100);
    }

    this.ballsManager.sync();

    // Pocket detection during SHOOTING
    if (this.state === 'SHOOTING') {
      const pocketed = this.ballsManager.checkPockets(this.table.getPocketPositions());
      if (pocketed.length > 0) {
        for (const id of pocketed) {
          this.audio.playPocket();
        }
      }

      if (this.ballsManager.allStopped()) {
        this.resolveTurn(pocketed);
      }
    }

    // Keep cue updated while aiming
    if ((this.state === 'AIM' || this.state === 'CHARGING') && this.cue.visible) {
      this.updateAimDirection();
    }
  }

  resolveTurn(pocketedIds) {
    const cueBall = this.ballsManager.getCueBall();
    const cuePocketed = cueBall.pocketed;

    const result = this.rules.resolveShot(pocketedIds, cuePocketed);

    if (result.gameOver) {
      this.state = 'GAME_OVER';
      this.ui.setMessage(result.message);
      this.ui.showResetButton(() => this.resetGame());
      if (result.winner === this.currentPlayer) {
        this.audio.playWin();
      } else {
        this.audio.playFoul();
      }
      return;
    }

    // Update UI
    this.ui.setMessage(result.message, 4000);
    this.currentPlayer = result.nextPlayer;
    this.ui.setPlayerTurn(this.currentPlayer);

    const status = this.rules.getStatus();
    this.ui.setPlayerGroups(status.player1Group, status.player2Group);

    if (result.foul || result.scratch) {
      this.audio.playFoul();
    }

    // Reset cue ball if scratched
    if (result.scratch) {
      this.ballsManager.resetCueBallIfPocketed();
    }

    this.state = 'AIM';
    this.power = 0;
    this.ui.setPower(0);
    this.cue.show();
  }

  resetGame() {
    // Remove old balls from scene and physics
    for (const ball of this.ballsManager.balls) {
      this.scene.remove(ball.mesh);
      this.physics.removeBody(ball.body);
      ball.geometry.dispose();
      ball.material.dispose();
    }

    this.ballsManager = new BallsManager(this.physics);
    this.ballsManager.createBalls();
    this.ballsManager.rackBalls();
    this.ballsManager.addToScene(this.scene);
    this.setupCollisionEvents();

    this.rules.reset();
    this.currentPlayer = 1;
    this.state = 'AIM';
    this.power = 0;
    this.ui.setPower(0);
    this.ui.setPlayerTurn(1);
    this.ui.setPlayerGroups(null, null);
    this.ui.setMessage('New game! Player 1 breaks.');
    this.ui.hideResetButton();
    this.ui.showResetButton(() => this.resetGame());
    this.cue.show();
  }

  render(renderer) {
    // Per-frame render logic if needed
  }
}
