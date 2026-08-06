import * as THREE from 'three';
import gsap from 'gsap';

export function initBookScene(container) {

  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a1a);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 1, 6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  const pageWidth = 2;
  const pageHeight = 3;
  const geometry = new THREE.PlaneGeometry(pageWidth, pageHeight);
  geometry.translate(pageWidth / 2, 0, 0);

  const material = new THREE.MeshStandardMaterial({
    color: 0xf5f5f0,
    side: THREE.DoubleSide,
    roughness: 0.3,
  });

  const page = new THREE.Mesh(geometry, material);
  scene.add(page);

  let isFlipped = false;
  const onClick = () => {
    gsap.to(page.rotation, {
      y: isFlipped ? 0 : -Math.PI,
      duration: 1.2,
      ease: 'power2.inOut',
    });
    isFlipped = !isFlipped;
  };

  const onResize = () => {
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
  };

  let animationFrameId = 0;
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };

  animate();
  window.addEventListener('click', onClick);
  window.addEventListener('resize', onResize);

  return () => {
    window.removeEventListener('click', onClick);
    window.removeEventListener('resize', onResize);
    cancelAnimationFrame(animationFrameId);
    renderer.dispose();
    geometry.dispose();
    material.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  };
}
