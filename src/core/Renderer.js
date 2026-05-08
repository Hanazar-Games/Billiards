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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // Controls (right-click orbit, middle zoom)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 80;
    this.controls.maxDistance = 900;
    this.controls.target.set(0, 0, 0);
    this.controls.mouseButtons = {
      LEFT: null,       // disable left-click orbit (used for shooting)
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    // Lights
    this.setupLights();

    // Resize handler
    this._onResize = this.onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  setupLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambient);

    // Main overhead lamp
    const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.1);
    mainLight.position.set(80, 450, 120);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 10;
    mainLight.shadow.camera.far = 1200;
    mainLight.shadow.camera.left = -350;
    mainLight.shadow.camera.right = 350;
    mainLight.shadow.camera.top = 250;
    mainLight.shadow.camera.bottom = -250;
    mainLight.shadow.bias = -0.0005;
    this.scene.add(mainLight);

    // Fill light (cool blue from opposite side)
    const fillLight = new THREE.DirectionalLight(0xcce0ff, 0.35);
    fillLight.position.set(-250, 200, -200);
    this.scene.add(fillLight);

    // Rim light (warm, from behind table)
    const rimLight = new THREE.DirectionalLight(0xffddaa, 0.25);
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

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}
