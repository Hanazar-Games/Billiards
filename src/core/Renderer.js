import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA } from '../config.js';

export class Renderer {
  constructor(container) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
    this.scene.fog = new THREE.Fog(0x1a1a1a, 600, 2500);

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
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
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
    this.controls.maxDistance = 900;
    this.controls.enableRotate = false;
    this.controls.enablePan = false;
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = 0.85;
    this.controls.target.set(0, 0, 0);
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
  }

  setupLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xe8f0ff, 0.26);
    this.scene.add(ambient);

    // Main overhead lamp, aimed at the table.
    const mainLight = new THREE.DirectionalLight(0xfff0d2, 1.65);
    mainLight.position.set(60, 520, 90);
    mainLight.castShadow = false;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 10;
    mainLight.shadow.camera.far = 1200;
    mainLight.shadow.camera.left = -260;
    mainLight.shadow.camera.right = 260;
    mainLight.shadow.camera.top = 180;
    mainLight.shadow.camera.bottom = -180;
    mainLight.shadow.bias = -0.0005;
    this.scene.add(mainLight);

    // Fill light (cool blue from opposite side)
    const fillLight = new THREE.DirectionalLight(0xb9d2ff, 0.22);
    fillLight.position.set(-250, 200, -200);
    this.scene.add(fillLight);

    // Rim light (warm, from behind table)
    const rimLight = new THREE.DirectionalLight(0xffcf95, 0.38);
    rimLight.position.set(0, 150, -400);
    this.scene.add(rimLight);
  }

  onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
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

    const dx = e.clientX - this._cameraLastX;
    const dy = e.clientY - this._cameraLastY;
    this._cameraLastX = e.clientX;
    this._cameraLastY = e.clientY;

    if (this._cameraDragMode === 'pan') {
      this.panCamera(dx, dy);
      e.preventDefault();
      return;
    }

    const target = this.controls.target;
    this._cameraOffset.copy(this.camera.position).sub(target);
    this._cameraSpherical.setFromVector3(this._cameraOffset);
    this._cameraSpherical.theta -= dx * 0.006;
    this._cameraSpherical.phi -= dy * 0.006;
    this._cameraSpherical.phi = Math.max(0.12, Math.min(this.controls.maxPolarAngle, this._cameraSpherical.phi));
    this._cameraSpherical.radius = Math.max(
      this.controls.minDistance,
      Math.min(this.controls.maxDistance, this._cameraSpherical.radius)
    );

    this._cameraOffset.setFromSpherical(this._cameraSpherical);
    this.camera.position.copy(target).add(this._cameraOffset);
    this.camera.lookAt(target);
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
    this.controls.update();
  }

  _updateCameraCursor(active = false) {
    if (active) {
      this.renderer.domElement.style.cursor = this._cameraDragMode === 'pan' ? 'move' : 'grabbing';
    } else {
      this.renderer.domElement.style.cursor = this._shiftCameraControl ? 'move' : '';
    }
  }

  onWheel(e) {
    if (!this._shiftCameraControl) return;
    e.preventDefault();

    let dx = e.deltaX;
    let dy = e.deltaY;
    if (e.deltaMode === 1) { // LINE
      dx *= 20;
      dy *= 20;
    } else if (e.deltaMode === 2) { // PAGE
      dx *= 100;
      dy *= 100;
    }

    this.panCamera(dx * 0.3, dy * 0.3);
  }

  render() {
    this.controls.update();
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
    this.renderer.domElement.removeEventListener('wheel', this._onWheel);
    if (this.controls) {
      this.controls.dispose();
    }
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
