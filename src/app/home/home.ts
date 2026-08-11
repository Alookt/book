import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import gsap from 'gsap';

/**
 * A simple interactive 3D book.
 *
 * - Built from scratch with Three.js (no external models).
 * - Click the book to toggle it between closed and open.
 * - The cover (front, back, spine, pages) animates open / shut.
 * - Drag to orbit the camera, scroll to zoom.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true })
  private canvasContainer!: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  // three.js core
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;

  // controls (written by hand to keep dependencies minimal)
  private cameraAzimuth = 0;
  private cameraElevation = 0.25;
  private cameraDistance = 5;
  private cameraTarget = new THREE.Vector3(0, 0, 0);

  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private dragStartAzEl = { az: 0, el: 0 };

  // the book
  private bookGroup = new THREE.Group();
  private coverGroup = new THREE.Group(); // pivots open / shut

  // interaction state
  private isOpen = false;
  private isAnimating = false;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  // animation
  private rafId = 0;
  private resizeHandler = () => this.handleResize();

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // run three.js outside Angular's zone to avoid change detection on every frame
    this.zone.runOutsideAngular(() => this.init());
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resizeHandler);

    const dom = this.renderer?.domElement;
    if (dom) {
      dom.removeEventListener('pointerdown', this.onPointerDown);
      dom.removeEventListener('wheel', this.onWheel);
    }
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);

    this.renderer?.dispose();
    this.renderer?.domElement.remove();

    this.scene?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    });
  }

  // -------------------------------------------------------------------
  // setup
  // -------------------------------------------------------------------

  private init(): void {
    const container = this.canvasContainer.nativeElement;
    const { clientWidth, clientHeight } = container;

    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(clientWidth, clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cursor = 'grab';
    container.appendChild(this.renderer.domElement);

    // scene
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      clientWidth / clientHeight,
      0.1,
      100,
    );
    this.updateCameraPosition();

    // lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const key = new THREE.DirectionalLight(0xfff1c4, 1.6);
    key.position.set(4, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x6688ff, 0.6);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);

    // build the book + a small ground plane
    this.scene.add(this.bookGroup);
    this.scene.add(this.makeGround());

    this.bookGroup.add(this.coverGroup);
    this.buildBook();

    // interaction
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.resizeHandler);

    this.tick();
  }

  /**
   * Build the book: back cover (static) + spine (static) + page block (static) + front cover (pivots).
   */
  private buildBook(): void {
    const bookWidth = 2.4;   // x
    const bookHeight = 3.2;  // y
    const bookDepth = 0.35;  // z — thickness of the closed book

    const coverColor = 0x8b2a1f;          // deep red leather
    const coverAccent = 0xd4a13a;         // gold
    const pageColor = 0xf2e6c4;            // aged paper
    const pageEdgeColor = 0xc9b88a;        // pages edge

    // --- materials ---
    const coverMaterial = new THREE.MeshStandardMaterial({
      color: coverColor,
      roughness: 0.55,
      metalness: 0.05,
    });
    const coverSpineMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(coverColor).multiplyScalar(0.75),
      roughness: 0.6,
      metalness: 0.05,
    });
    const pageMaterial = new THREE.MeshStandardMaterial({
      color: pageColor,
      roughness: 0.95,
      metalness: 0.0,
    });
    const pageEdgeMaterial = new THREE.MeshStandardMaterial({
      color: pageEdgeColor,
      roughness: 0.95,
      metalness: 0.0,
    });
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: coverAccent,
      roughness: 0.35,
      metalness: 0.85,
    });

    // --- back cover (static, part of the book group) ---
    const backCover = new THREE.Mesh(
      new THREE.BoxGeometry(bookWidth, bookHeight, 0.06),
      coverMaterial,
    );
    backCover.position.set(0, 0, -bookDepth / 2 + 0.03);
    backCover.castShadow = true;
    backCover.receiveShadow = true;
    this.bookGroup.add(backCover);

    // gold rectangle on the back cover
    const backAccent = new THREE.Mesh(
      new THREE.BoxGeometry(bookWidth * 0.6, bookHeight * 0.85, 0.005),
      goldMaterial,
    );
    backAccent.position.set(0, 0, -bookDepth / 2 + 0.062);
    backAccent.castShadow = false;
    backAccent.receiveShadow = true;
    this.bookGroup.add(backAccent);

    // --- page block (static, sits between the covers) ---
    const pageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(
        bookWidth - 0.08,
        bookHeight - 0.08,
        bookDepth - 0.12,
      ),
      pageMaterial,
    );
    pageBlock.castShadow = true;
    pageBlock.receiveShadow = true;
    this.bookGroup.add(pageBlock);

    // --- spine (static, part of the book group, on the left edge) ---
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, bookHeight + 0.02, bookDepth),
      coverSpineMaterial,
    );
    spine.position.set(-bookWidth / 2 + 0.05, 0, 0);
    spine.castShadow = true;
    spine.receiveShadow = true;
    this.bookGroup.add(spine);

    // gold lines on the spine
    for (const yOff of [-bookHeight * 0.35, bookHeight * 0.35]) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, bookHeight * 0.1, 0.005),
        goldMaterial,
      );
      line.position.set(-bookWidth / 2 + 0.005, yOff, bookDepth / 2 - 0.01);
      this.bookGroup.add(line);
    }

    // --- front cover (pivots on the left spine edge) ---
    // pivot is at the left edge of the cover so it swings like a real book.
    this.coverGroup.position.set(-bookWidth / 2, 0, bookDepth / 2 - 0.03);

    const frontCover = new THREE.Mesh(
      new THREE.BoxGeometry(bookWidth, bookHeight, 0.06),
      coverMaterial,
    );
    // shift the cover so its left edge is at the pivot's origin
    frontCover.position.set(bookWidth / 2, 0, 0);
    frontCover.castShadow = true;
    frontCover.receiveShadow = true;
    this.coverGroup.add(frontCover);

    // gold frame on the front cover
    const frontFrame = new THREE.Mesh(
      new THREE.BoxGeometry(bookWidth * 0.65, bookHeight * 0.85, 0.005),
      goldMaterial,
    );
    frontFrame.position.set(bookWidth / 2, 0, 0.034);
    frontFrame.castShadow = false;
    frontFrame.receiveShadow = true;
    this.coverGroup.add(frontFrame);

    // a small title bar in the middle of the front cover
    const titleBar = new THREE.Mesh(
      new THREE.BoxGeometry(bookWidth * 0.4, bookHeight * 0.08, 0.008),
      goldMaterial,
    );
    titleBar.position.set(bookWidth / 2, 0, 0.04);
    this.coverGroup.add(titleBar);

    // close the book initially
    this.coverGroup.rotation.z = 0;
  }

  private makeGround(): THREE.Mesh {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.35 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.0;
    ground.receiveShadow = true;
    return ground;
  }

  // -------------------------------------------------------------------
  // interaction
  // -------------------------------------------------------------------

  private onPointerDown = (e: PointerEvent): void => {
    // distinguish click vs drag by tracking movement
    this.isDragging = true;
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.dragStartAzEl = {
      az: this.cameraAzimuth,
      el: this.cameraElevation,
    };
    if (this.renderer) this.renderer.domElement.style.cursor = 'grabbing';
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    this.cameraAzimuth = this.dragStartAzEl.az - dx * 0.005;
    this.cameraElevation = THREE.MathUtils.clamp(
      this.dragStartAzEl.el - dy * 0.005,
      -0.3,
      1.2,
    );
    this.updateCameraPosition();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    if (this.renderer) this.renderer.domElement.style.cursor = 'grab';

    // if the pointer barely moved, treat it as a click on the book
    const dx = e.clientX - this.dragStart.x;
    const dy = e.clientY - this.dragStart.y;
    if (Math.hypot(dx, dy) < 4) {
      this.handleClick(e);
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.08 : 1 / 1.08;
    this.cameraDistance = THREE.MathUtils.clamp(
      this.cameraDistance * factor,
      2.5,
      12,
    );
    this.updateCameraPosition();
  };

  private handleClick(e: PointerEvent): void {
    if (!this.renderer || !this.camera || this.isAnimating) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    // hit-test the whole book (any child of bookGroup counts as a click on the book)
    const intersects = this.raycaster.intersectObject(this.bookGroup, true);
    if (intersects.length === 0) return;

    this.toggleBook();
  }

  private toggleBook(): void {
    this.isOpen = !this.isOpen;
    this.isAnimating = true;
    if (this.renderer) this.renderer.domElement.style.cursor = 'wait';

    gsap.to(this.coverGroup.rotation, {
      z: this.isOpen ? -Math.PI * 0.95 : 0,
      duration: 1.1,
      ease: 'power2.inOut',
      onComplete: () => {
        this.isAnimating = false;
        if (this.renderer) this.renderer.domElement.style.cursor = 'grab';
        this.updateHint();
      },
    });
  }

  private updateHint(): void {
    const hint = document.getElementById('hint');
    if (hint) hint.textContent = this.isOpen ? 'Click the book to close it.' : 'Click the book to open it.';
  }

  // -------------------------------------------------------------------
  // camera + render loop
  // -------------------------------------------------------------------

  private updateCameraPosition(): void {
    if (!this.camera) return;
    const r = this.cameraDistance;
    const az = this.cameraAzimuth;
    const el = this.cameraElevation;
    this.camera.position.set(
      r * Math.cos(el) * Math.sin(az),
      r * Math.sin(el),
      r * Math.cos(el) * Math.cos(az),
    );
    this.camera.lookAt(this.cameraTarget);
  }

  private handleResize(): void {
    if (!this.renderer || !this.camera) return;
    const w = this.canvasContainer.nativeElement.clientWidth;
    const h = this.canvasContainer.nativeElement.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private tick = (): void => {
    this.rafId = requestAnimationFrame(this.tick);
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };
}
  