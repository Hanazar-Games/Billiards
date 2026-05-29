import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA, ROOM } from '../config.js';
import { settings } from './SettingsStore.js';

export class Renderer {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf5e6c8);
    this.scene.fog = new THREE.Fog(0xe8dcc8, 800, 2800);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      CAMERA.fov,
      this.width / this.height,
      CAMERA.near,
      CAMERA.far
    );
    this.camera.position.set(...CAMERA.defaultPos);
    this.camera.lookAt(...CAMERA.lookAt);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: settings.get('antialiasEnabled') !== false });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);

    // Controls: Shift+left-drag = pan, Shift+right-drag = orbit; wheel = zoom.
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 80;
    this.controls.maxDistance = 700;
    this.controls.enableRotate = false;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 0.85 * (settings.get('cameraZoomSens') || 1.0);
    this.controls.target.set(...CAMERA.lookAt);
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: null,
      RIGHT: null,
    };
    this._shiftCameraControl = false;
    this._cameraDragMode = null;
    this._cameraLastX = 0;
    this._cameraLastY = 0;
    this._cameraSpherical = new THREE.Spherical();
    this._cameraOffset = new THREE.Vector3();
    this._cameraPanRight = new THREE.Vector3();
    this._cameraPanUp = new THREE.Vector3();
    this._cameraPanDelta = new THREE.Vector3();
    this._onKeyDown = (e) => {
      if (e.key === 'Shift') this.setCameraControlActive(true);
    };
    this._onKeyUp = (e) => {
      if (e.key === 'Shift') this.setCameraControlActive(false);
    };
    this._onBlur = () => this.setCameraControlActive(false);
    this._onCameraPointerDown = this.onCameraPointerDown.bind(this);
    this._onCameraPointerMove = this.onCameraPointerMove.bind(this);
    this._onCameraPointerUp = this.onCameraPointerUp.bind(this);
    this._onWheel = this.onWheel.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.renderer.domElement.addEventListener('pointerdown', this._onCameraPointerDown);
    window.addEventListener('pointermove', this._onCameraPointerMove);
    window.addEventListener('pointerup', this._onCameraPointerUp);
    this.renderer.domElement.addEventListener('wheel', this._onWheel, { passive: false });

    // Lights
    this.setupLights();

    // Resize handler
    this._onResize = this.onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    // Apply quality & shadow settings
    this.applyQualitySettings();
    this._onSettingsChanged = (e) => {
      const key = e.detail?.key;
      const value = e.detail?.value;
      if (key === 'quality' || key === 'shadowsEnabled') {
        this.applyQualitySettings();
      }
      if (key === 'cameraFov') {
        const fov = Number(value) || CAMERA.fov;
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
      }
      if (key === 'cameraZoomSens') {
        this.controls.zoomSpeed = 0.85 * (Number(value) || 1.0);
      }
      if (key === 'cameraDamping') {
        this.controls.dampingFactor = 0.05 * (Number(value) || 1.0);
      }
      if (key === 'lightingIntensity' && this._mainLight) {
        this._mainLight.intensity = 1.45 * (Number(value) || 1.0);
      }
      if (key === 'ambientIntensity' && this._ambientLight) {
        this._ambientLight.intensity = 0.40 * (Number(value) || 1.0);
      }
      if (key === 'toneMappingExposure') {
        this.renderer.toneMappingExposure = Number(value) || 1.08;
      }
      if (key === 'fogEnabled') {
        this.scene.fog = value ? new THREE.Fog(0xe8dcc8, 800, 2800) : null;
      }
      if (key === 'renderScale') {
        const scale = Math.max(0.5, Math.min(2.0, Number(value) || 1.0));
        this._renderScale = scale;
        this.renderer.setSize(this.width * scale, this.height * scale, false);
      }
    };
    window.addEventListener('settingsChanged', this._onSettingsChanged);

    this._onRoomThemeChanged = (e) => {
      const detail = e.detail || {};
      if (this._ambientLight && detail.ambientColor != null) {
        this._ambientLight.color.setHex(detail.ambientColor);
      }
      if (this._ambientLight && detail.ambientIntensity != null) {
        const baseIntensity = settings.get('ambientIntensity') ?? 0.5;
        this._ambientLight.intensity = detail.ambientIntensity * baseIntensity;
      }
    };
    window.addEventListener('roomThemeChanged', this._onRoomThemeChanged);
  }

  setupLights() {
    // Ambient — lowered so table lamps feel like the primary source
    this._ambientLight = new THREE.AmbientLight(0xfff8f0, 0.32);
    this.scene.add(this._ambientLight);

    // Main overhead lamp (simulates window spill / room bounce).
    // Intentionally weaker than the table spots so the pool-table
    // lamps read as the dominant light source.
    this._mainLight = new THREE.DirectionalLight(0xfff5e0, 0.85);
    this._mainLight.position.set(60, 520, 90);
    this._mainLight.castShadow = true;
    this._mainLight.shadow.mapSize.width = 2048;
    this._mainLight.shadow.mapSize.height = 2048;
    this._mainLight.shadow.camera.near = 10;
    this._mainLight.shadow.camera.far = 1200;
    this._mainLight.shadow.camera.left = -300;
    this._mainLight.shadow.camera.right = 300;
    this._mainLight.shadow.camera.top = 400;
    this._mainLight.shadow.camera.bottom = -400;
    this._mainLight.shadow.bias = -0.0005;
    this.scene.add(this._mainLight);

    // Fill light (cool blue from opposite side)
    this._fillLight = new THREE.DirectionalLight(0xc8d8f0, 0.15);
    this._fillLight.position.set(-250, 200, -200);
    this.scene.add(this._fillLight);

    // Rim light (warm, from behind table)
    this._rimLight = new THREE.DirectionalLight(0xffe8c8, 0.20);
    this._rimLight.position.set(0, 150, -400);
    this.scene.add(this._rimLight);
  }

  onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    if (this.width <= 0 || this.height <= 0) return;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    const s = this._renderScale || 1.0;
    this.renderer.setSize(this.width * s, this.height * s, false);
  }

  setCameraControlActive(active) {
    this._shiftCameraControl = Boolean(active);
    if (!this._shiftCameraControl) {
      this._cameraDragMode = null;
    }
    this.controls.enableRotate = false;
    this.controls.enableZoom = !active; // disable OrbitControls zoom while shift is held
    this._updateCameraCursor();
  }

  onCameraPointerDown(e) {
    let mode = null;
    if (this._shiftCameraControl && e.button === 0) {
      mode = 'pan';   // Shift + left drag = pan
    } else if (this._shiftCameraControl && e.button === 2) {
      mode = 'orbit'; // Shift + right drag = orbit
    } else if (e.button === 1) {
      mode = 'pan';   // Middle drag = pan (fallback)
    }
    if (!mode) return;

    this._cameraDragMode = mode;
    this._cameraLastX = e.clientX;
    this._cameraLastY = e.clientY;
    this._updateCameraCursor(true);
    if (this.renderer.domElement.setPointerCapture) {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
  }

  onCameraPointerMove(e) {
    if (!this._cameraDragMode) return;

    const invX = (settings.get('invertMouseX') !== false) ? -1 : 1;
    const invY = (settings.get('invertMouseY') !== false) ? -1 : 1;
    const dx = (e.clientX - this._cameraLastX) * invX;
    const dy = (e.clientY - this._cameraLastY) * invY;
    this._cameraLastX = e.clientX;
    this._cameraLastY = e.clientY;

    const sens = settings.get('mouseSensitivity') || 1.0;

    const rotateSens = (settings.get('cameraRotateSens') || 1.0);
    if (this._cameraDragMode === 'pan') {
      const panSens = (settings.get('cameraPanSens') || 1.0);
      this.panCamera(dx * sens * panSens, dy * sens * panSens);
      this._clampCameraToRoom();
      e.preventDefault();
      return;
    }

    const target = this.controls.target;
    this._cameraOffset.copy(this.camera.position).sub(target);
    this._cameraSpherical.setFromVector3(this._cameraOffset);
    this._cameraSpherical.theta -= dx * 0.006 * sens * rotateSens;
    this._cameraSpherical.phi -= dy * 0.006 * sens * rotateSens;
    this._cameraSpherical.phi = Math.max(0.12, Math.min(this.controls.maxPolarAngle, this._cameraSpherical.phi));
    this._cameraSpherical.radius = Math.max(
      this.controls.minDistance,
      Math.min(this.controls.maxDistance, this._cameraSpherical.radius)
    );

    this._cameraOffset.setFromSpherical(this._cameraSpherical);
    this.camera.position.copy(target).add(this._cameraOffset);
    this.camera.lookAt(target);
    this._clampCameraToRoom();
    this.controls.update();
    e.preventDefault();
  }

  onCameraPointerUp(e) {
    this._cameraDragMode = null;
    this._updateCameraCursor();
    if (this.renderer.domElement.releasePointerCapture) {
      try {
        this.renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }
  }

  panCamera(dx, dy) {
    const targetDistance = this.camera.position.distanceTo(this.controls.target);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const worldHeight = 2 * Math.tan(fov / 2) * targetDistance;
    const worldWidth = worldHeight * this.camera.aspect;
    const panX = -dx * worldWidth / Math.max(1, this.width);
    const panY = dy * worldHeight / Math.max(1, this.height);

    this.camera.getWorldDirection(this._cameraPanDelta);
    this._cameraPanRight.crossVectors(this._cameraPanDelta, this.camera.up).normalize();
    this._cameraPanUp.crossVectors(this._cameraPanRight, this._cameraPanDelta).normalize();
    this._cameraPanDelta
      .copy(this._cameraPanRight).multiplyScalar(panX)
      .addScaledVector(this._cameraPanUp, panY);

    this.camera.position.add(this._cameraPanDelta);
    this.controls.target.add(this._cameraPanDelta);
    this._clampCameraToRoom();
    this.controls.update();
  }

  _clampCameraToRoom() {
    if (settings.get('cameraCollisionAvoidance') === false) return;
    const cam = this.camera.position;
    const tgt = this.controls.target;
    const wallMargin = 70; // increased to prevent camera clipping through walls

    // Clamp camera position — keep a safe margin from walls to prevent
    // the camera from seeing through or clipping into wall geometry.
    cam.x = Math.max(-ROOM.halfWidth + wallMargin, Math.min(ROOM.halfWidth - wallMargin, cam.x));
    cam.z = Math.max(-ROOM.halfDepth + wallMargin, Math.min(ROOM.halfDepth - wallMargin, cam.z));
    cam.y = Math.max(ROOM.minCameraY, Math.min(ROOM.maxCameraY, cam.y));

    // Clamp orbit target (keep it within a smaller inner zone so
    // the camera never looks at a point outside the room)
    tgt.x = Math.max(-ROOM.halfWidth * 0.45, Math.min(ROOM.halfWidth * 0.45, tgt.x));
    tgt.z = Math.max(-ROOM.halfDepth * 0.45, Math.min(ROOM.halfDepth * 0.45, tgt.z));
    tgt.y = Math.max(-20, Math.min(80, tgt.y));
  }

  _updateCameraCursor(active = false) {
    if (active) {
      this.renderer.domElement.style.cursor = this._cameraDragMode === 'pan' ? 'move' : 'grabbing';
    } else {
      this.renderer.domElement.style.cursor = this._shiftCameraControl ? 'move' : '';
    }
  }

  onWheel(e) {
    const invX = (settings.get('invertMouseX') !== false) ? -1 : 1;
    const invY = (settings.get('invertMouseY') !== false) ? -1 : 1;
    let dx = e.deltaX * invX;
    let dy = e.deltaY * invY;
    if (e.deltaMode === 1) { // LINE
      dx *= 20;
      dy *= 20;
    } else if (e.deltaMode === 2) { // PAGE
      dx *= 100;
      dy *= 100;
    }

    const sens = settings.get('mouseSensitivity') || 1.0;

    const rotateSens = (settings.get('cameraRotateSens') || 1.0);
    const panSens = (settings.get('cameraPanSens') || 1.0);
    const trackSens = (settings.get('trackpadSens') || 1.0);

    // Pinch-to-zoom (macOS trackpad) is signaled by ctrlKey/metaKey on the wheel event.
    const isPinch = e.ctrlKey || e.metaKey;
    // Distinguish mouse wheel (mostly vertical) from trackpad two-finger drag:
    // Mouse wheel typically has |dx| ≈ 0 and |dy| ≫ 0 — keep OrbitControls zoom for that.
    const isMouseWheel = Math.abs(dx) < 2 && Math.abs(dy) > 2;

    if (isPinch) {
      // Pinch-to-zoom always goes to OrbitControls
      return;
    }

    if (this._shiftCameraControl) {
      // Shift + two-finger drag = Pan
      e.preventDefault();
      this.panCamera(dx * 0.3 * sens * panSens * trackSens, dy * 0.3 * sens * panSens * trackSens);
      this._clampCameraToRoom();
      return;
    }

    // Two-finger without Shift = Orbit (free look)
    // Mouse wheel (mostly vertical) → let OrbitControls handle zoom
    if (isMouseWheel) return;

    e.preventDefault();
    const target = this.controls.target;
    this._cameraOffset.copy(this.camera.position).sub(target);
    this._cameraSpherical.setFromVector3(this._cameraOffset);
    this._cameraSpherical.theta -= dx * 0.003 * sens * rotateSens * trackSens;
    this._cameraSpherical.phi -= dy * 0.003 * sens * rotateSens * trackSens;
    this._cameraSpherical.phi = Math.max(
      0.12,
      Math.min(this.controls.maxPolarAngle, this._cameraSpherical.phi)
    );
    this._cameraSpherical.radius = Math.max(
      this.controls.minDistance,
      Math.min(this.controls.maxDistance, this._cameraSpherical.radius)
    );
    this._cameraOffset.setFromSpherical(this._cameraSpherical);
    this.camera.position.copy(target).add(this._cameraOffset);
    this.camera.lookAt(target);
    this._clampCameraToRoom();
    this.controls.update();
  }

  applyQualitySettings() {
    const quality = settings.get('quality') || 'high';
    const shadows = settings.get('shadowsEnabled') !== false;

    // Pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const userMaxDpr = settings.get('maxPixelRatio') || 2;
    const maxDpr = quality === 'low' ? 1 : (quality === 'medium' ? Math.min(1.5, userMaxDpr) : userMaxDpr);
    this.renderer.setPixelRatio(Math.min(dpr, maxDpr));

    // Shadow map
    const wasEnabled = this.renderer.shadowMap.enabled;
    this.renderer.shadowMap.enabled = shadows;
    if (shadows) {
      const size = quality === 'low' ? 1024 : (quality === 'medium' ? 1536 : 2048);
      this.scene.traverse((obj) => {
        if (obj.isLight && obj.shadow) {
          obj.shadow.mapSize.width = size;
          obj.shadow.mapSize.height = size;
          obj.shadow.map?.setSize(size, size);
        }
      });
    }
    if (wasEnabled !== shadows) {
      this.scene.traverse((obj) => {
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => { m.needsUpdate = true; });
          } else {
            obj.material.needsUpdate = true;
          }
        }
      });
    }
  }

  render() {
    this.controls.update();
    this._clampCameraToRoom();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.renderer.domElement.removeEventListener('pointerdown', this._onCameraPointerDown);
    window.removeEventListener('pointermove', this._onCameraPointerMove);
    window.removeEventListener('pointerup', this._onCameraPointerUp);
    this.renderer.domElement.removeEventListener('wheel', this._onWheel, { passive: false });
    window.removeEventListener('settingsChanged', this._onSettingsChanged);
    window.removeEventListener('roomThemeChanged', this._onRoomThemeChanged);
    if (this.controls) {
      this.controls.dispose();
    }
    // Release any active pointer capture to prevent stuck pointers
    if (this.renderer && this.renderer.domElement) {
      try {
        this.renderer.domElement.releasePointerCapture && this.renderer.domElement.releasePointerCapture(1);
      } catch (e) {}
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
