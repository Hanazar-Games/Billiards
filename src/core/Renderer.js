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

    // Controls: hold Shift to orbit with left drag; wheel zoom remains available.
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
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: null,
    };
    this._shiftCameraControl = false;
    this._onKeyDown = (e) => {
      if (e.key === 'Shift') this.setCameraControlActive(true);
    };
    this._onKeyUp = (e) => {
      if (e.key === 'Shift') this.setCameraControlActive(false);
    };
    this._onBlur = () => this.setCameraControlActive(false);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

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
    this.controls.enableRotate = this._shiftCameraControl;
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
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
