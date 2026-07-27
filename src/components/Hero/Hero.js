import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const hero = document.querySelector("[data-bubble-hero]");
if (!(hero instanceof HTMLElement)) {
  throw new Error("Bubble hero root not found.");
}

const mount = hero.querySelector("[data-bubble-canvas]");
if (!(mount instanceof HTMLElement)) {
  throw new Error("Bubble canvas mount not found.");
}

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setClearColor(0x000000, 0);
mount.appendChild(renderer.domElement);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
const environmentTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);

const scene = new THREE.Scene();
scene.environment = environmentTarget.texture;
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 40);
camera.position.set(0, 0.1, 5.8);
camera.lookAt(0, 0, 0);

const ambient = new THREE.HemisphereLight(0xc9ddff, 0x182030, 1.2);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(2.2, 2.8, 2.5);
scene.add(keyLight);

const backLight = new THREE.PointLight(0x7bc8ff, 1.8, 10);
backLight.position.set(-2.4, -1.4, -2.1);
scene.add(backLight);

const backgroundGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
const backgroundMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});
const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
backgroundMesh.position.z = -8;
backgroundMesh.visible = false;
scene.add(backgroundMesh);

const bubbleGroup = new THREE.Group();
bubbleGroup.position.set(0, 0.05, 0.2);
scene.add(bubbleGroup);

const BUBBLE_MARGIN = 0.05;
const BUBBLE_SHAPE = new THREE.Vector3(1.15, 1.05, 0.88);
const BUBBLE_BASE_RADIUS = 1.12;
const BUBBLE_DISTORTION_PAD = 1.0;
const BUBBLE_FLOAT_AMPLITUDE = 0.14;

const bubbleGeometry = new THREE.SphereGeometry(1.12, 128, 128);
const bubbleMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.72,
  side: THREE.FrontSide,
  roughness: 0.0,
  metalness: 0.0,
  transmission: 1.0,
  thickness: 0.35,
  ior: 1.03,
  iridescence: 1.0,
  iridescenceIOR: 1.8,
  iridescenceThicknessRange: [200, 700],
  clearcoat: 1.0,
  clearcoatRoughness: 0.0,
  envMapIntensity: 3.0,
  depthWrite: false,
});

const applyBubbleShader = (material) => {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float waveA = sin(position.y * 4.6 + uTime * 1.12);
      float waveB = sin(position.x * 6.4 - uTime * 1.38);
      float waveC = sin(position.z * 5.3 + uTime * 0.92);
      float wave = waveA * 0.5 + waveB * 0.32 + waveC * 0.22;
      transformed += normal * (0.065 * wave);
    `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <output_fragment>",
      `
    float luma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
    outgoingLight = mix(vec3(luma), outgoingLight, 2.4);
    #include <output_fragment>
    `
    );
    material.userData.shader = shader;
  };

  material.needsUpdate = true;
};

applyBubbleShader(bubbleMaterial);

const bubbleMesh = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
bubbleMesh.renderOrder = 2;
bubbleGroup.add(bubbleMesh);

const shadowGeometry = new THREE.PlaneGeometry(2.6, 1.2, 1, 1);
const shadowMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uOpacity: { value: 0.10 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying vec2 vUv;

    void main() {
      vec2 p = vUv - 0.5;
      vec2 q = vec2(p.x * 1.12, p.y * 1.9);
      float m = exp(-8.5 * dot(q, q));
      gl_FragColor = vec4(0.015, 0.02, 0.03, m * uOpacity);
    }
  `,
});

const shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
shadowMesh.position.set(0, -1.45, -0.25);
shadowMesh.rotation.x = -Math.PI * 0.5;
shadowMesh.renderOrder = 1;
scene.add(shadowMesh);

let backgroundTexture = null;

const updateTextureCover = (texture, viewportAspect) => {
  if (!texture.image) {
    return;
  }

  const imageAspect = texture.image.width / Math.max(texture.image.height, 1);
  texture.center.set(0.5, 0.5);

  if (viewportAspect > imageAspect) {
    texture.repeat.set(1, imageAspect / viewportAspect);
    texture.offset.set(0, (1 - texture.repeat.y) * 0.5);
  } else {
    texture.repeat.set(viewportAspect / imageAspect, 1);
    texture.offset.set((1 - texture.repeat.x) * 0.5, 0);
  }
};

const updateBackgroundPlane = () => {
  const distance = camera.position.z - backgroundMesh.position.z;
  const fovRadians = THREE.MathUtils.degToRad(camera.fov);
  const viewHeight = 2 * Math.tan(fovRadians * 0.5) * distance;
  const viewWidth = viewHeight * camera.aspect;
  backgroundMesh.scale.set(viewWidth, viewHeight, 1);
  backgroundMesh.visible = Boolean(backgroundTexture);

  if (backgroundTexture) {
    updateTextureCover(backgroundTexture, camera.aspect);
  }
};

const updateBubbleScale = () => {
  const distance = camera.position.z - bubbleGroup.position.z;
  const fovRadians = THREE.MathUtils.degToRad(camera.fov);
  const viewHeight = 2 * Math.tan(fovRadians * 0.5) * distance;
  const viewWidth = viewHeight * camera.aspect;

  const availableWidth = viewWidth * (1 - 2 * BUBBLE_MARGIN);
  const availableHeight = viewHeight * (1 - 2 * BUBBLE_MARGIN);

  const halfWidthDenominator = BUBBLE_BASE_RADIUS * BUBBLE_SHAPE.x * BUBBLE_DISTORTION_PAD;
  const halfHeightDenominator = BUBBLE_BASE_RADIUS * BUBBLE_SHAPE.y * BUBBLE_DISTORTION_PAD;

  const scaleByWidth = (availableWidth * 0.5) / Math.max(halfWidthDenominator, 1e-4);
  const heightBudget = Math.max((availableHeight * 0.5) - BUBBLE_FLOAT_AMPLITUDE, 1e-4);
  const scaleByHeight = heightBudget / Math.max(halfHeightDenominator, 1e-4);

  const uniformScale = Math.max(Math.min(scaleByWidth, scaleByHeight), 0.01);
  bubbleGroup.scale.set(
    BUBBLE_SHAPE.x * uniformScale,
    BUBBLE_SHAPE.y * uniformScale,
    BUBBLE_SHAPE.z * uniformScale
  );
};

const clock = new THREE.Clock();
let rafId = 0;
let isVisible = true;

const resize = () => {
  const width = Math.max(1, mount.clientWidth);
  const height = Math.max(1, mount.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  updateBackgroundPlane();
  updateBubbleScale();
};

const render = () => {
  if (!isVisible) {
    rafId = requestAnimationFrame(render);
    return;
  }

  const t = clock.getElapsedTime();
  const shader = bubbleMaterial.userData.shader;
  if (shader?.uniforms?.uTime) {
    shader.uniforms.uTime.value = t;
  }
  bubbleGroup.position.y = 0.02 + Math.sin(t * 0.75) * BUBBLE_FLOAT_AMPLITUDE;
  bubbleGroup.rotation.y = t * 0.22;
  bubbleGroup.rotation.x = Math.sin(t * 0.41) * 0.07;
  renderer.render(scene, camera);
  rafId = requestAnimationFrame(render);
};

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(mount);

const visibilityObserver = new IntersectionObserver(
  (entries) => {
    isVisible = entries[0]?.isIntersecting ?? true;
  },
  { threshold: 0.01 }
);
visibilityObserver.observe(hero);

resize();
render();

const cleanup = () => {
  cancelAnimationFrame(rafId);
  resizeObserver.disconnect();
  visibilityObserver.disconnect();

  backgroundGeometry.dispose();
  backgroundMaterial.dispose();
  bubbleGeometry.dispose();
  bubbleMaterial.dispose();
  shadowGeometry.dispose();
  shadowMaterial.dispose();

  if (backgroundTexture) {
    backgroundTexture.dispose();
  }

  environmentTarget.texture.dispose();
  pmremGenerator.dispose();
  renderer.dispose();
};

window.addEventListener("pagehide", cleanup, { once: true });
