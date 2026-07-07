import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export function initProductRenderer() {
  const mount = document.getElementById("pf-product");
  if (!mount || !window.WebGLRenderingContext) return null;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  camera.position.set(0.08, 0.02, 4.15);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  mount.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xf2d0be, 1.75));

  const key = new THREE.DirectionalLight(0xffffff, 3.5);
  key.position.set(3.2, 3.6, 4.2);
  scene.add(key);

  const warmFill = new THREE.DirectionalLight(0xff9a62, 1.55);
  warmFill.position.set(-2.5, 1.1, 2.4);
  scene.add(warmFill);

  const rim = new THREE.DirectionalLight(0xffffff, 2.1);
  rim.position.set(-2.9, 2.8, -2.5);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    mount.dataset.productModel || "./assets/models/PF_Hero_Orange.optimized.glb",
    (gltf) => {
      const raw = new THREE.Group();
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((child) => {
        if (!child.isMesh) return;
        const mesh = new THREE.Mesh(child.geometry, child.material);
        mesh.matrix.copy(child.matrixWorld);
        mesh.matrixAutoUpdate = false;
        raw.add(mesh);
      });

      const box = new THREE.Box3().setFromObject(raw);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxAxis = Math.max(size.x, size.y, size.z);
      raw.position.set(-center.x, -center.y, -center.z);

      const object = new THREE.Group();
      object.scale.setScalar(maxAxis > 0 ? 2.32 / maxAxis : 1);
      object.rotation.set(0.12, -0.58, -0.03);
      object.add(raw);

      raw.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!material) return;
          if (material.color) material.color.lerp(new THREE.Color(0xf04e23), 0.08);
          if ("roughness" in material) material.roughness = Math.min(0.82, Math.max(0.5, material.roughness || 0.62));
          if ("metalness" in material) material.metalness = Math.min(0.06, material.metalness || 0);
          material.needsUpdate = true;
        });
      });

      group.add(object);
      mount.classList.add("is-loaded");
      mount.dispatchEvent(new CustomEvent("pf-product-ready"));
    },
    undefined,
    () => {
      mount.classList.add("is-fallback");
      mount.dispatchEvent(new CustomEvent("pf-product-ready"));
    }
  );

  function resize() {
    const rect = mount.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(mount);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }
  resize();

  const start = performance.now();

  function tick(now) {
    const time = (now - start) / 1000;

    if (!reduced) {
      group.rotation.y = Math.sin(time * 0.34) * 0.045;
      group.rotation.x = Math.sin(time * 0.24) * 0.024;
      group.rotation.z = Math.sin(time * 0.28) * 0.018;
      group.position.y = Math.sin(time * 0.58) * 0.035;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
  return { scene, camera, renderer, group };
}
