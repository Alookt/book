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
 * An interactive 3D book that opens, turns pages, and closes.
 *
 * - Built from scratch with Three.js (no external models).
 * - Three states: closed → open → middle → closed.
 *   Click 1: cover swings open + first pages turn, exposing a left/right spread.
 *   Click 2: more pages turn to expose a "middle" spread.
 *   Click 3: pages flip back and the cover closes.
 * - Pages have a leading-edge curl during the turn (custom shader on a
 *   segmented PlaneGeometry).
 * - Drag to orbit, scroll to zoom.
 */
type BookState = 'closed' | 'open' | 'middle';

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
  private coverGroup = new THREE.Group(); // pivots open / shut (Z axis)

  // turning pages — each is a pivot + mesh
  private pagePivots: THREE.Group[] = [];
  private pageMaterials: THREE.ShaderMaterial[] = [];

  // interaction state
  private state: BookState = 'closed';
  private isAnimating = false;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  // animation
  private rafId = 0;
  private resizeHandler = () => this.handleResize();

  // book dimensions (kept as fields so transition code can reuse them)
  private bookWidth = 2.4;
  private bookHeight = 3.2;
  private bookDepth = 0.35;

  // cover Z positions: when the book is closed the cover sits above the
  // page stack so it hides the pages; when open it slides underneath so the
  // pages rest on top of it.
  private coverZClosed = 0;
  private coverZOpen = 0;

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
   * Build the book: back cover, spine, page block, turning pages, front cover.
   */
  private buildBook(): void {
    const bookWidth = this.bookWidth;
    const bookHeight = this.bookHeight;
    const bookDepth = this.bookDepth;

    const coverColor = 0x8b2a1f;          // deep red leather
    const coverAccent = 0xd4a13a;         // gold
    const pageColor = 0xf2e6c4;           // aged paper
    const pageEdgeColor = 0xc9b88a;       // page edges

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

    // --- back cover (static) ---
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
    backAccent.receiveShadow = true;
    this.bookGroup.add(backAccent);

    // --- page block (static, the visible bulk on the right when open) ---
    const pageBlock = new THREE.Mesh(
      new THREE.BoxGeometry(
        bookWidth - 0.08,
        bookHeight - 0.08,
        bookDepth - 0.12,
      ),
      pageEdgeMaterial,
    );
    pageBlock.castShadow = true;
    pageBlock.receiveShadow = true;
    this.bookGroup.add(pageBlock);

    // --- spine (static) ---
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

    // --- turning pages (each pivots around the spine Y-axis) ---
    // Each page starts on the right side of the spine, lying flat. Rotating
    // its pivot around Y by -PI flips it over to the left side.
    const pageWidth = bookWidth - 0.08;
    const pageHeight = bookHeight - 0.08;
    const pageCount = 4;
    // Slight Z-stagger so pages stack in 3D rather than z-fighting.
    const zStep = 0.0195;

    for (let i = 0; i < pageCount; i++) {
      const pivot = new THREE.Group();
      // pivot origin sits at the spine (left edge of the closed page)
      pivot.position.set(-bookWidth / 2 + 0.04, 0, zStep * i);

      const material = this.makePageCurlMaterial(pageColor);
      const mesh = new THREE.Mesh(
        // 32 width-segments so the shader can bend the page smoothly
        new THREE.PlaneGeometry(pageWidth, pageHeight, 32, 1),
        material,
      );
      // shift the page so its left edge is at the pivot origin
      mesh.position.set(pageWidth / 2, 0, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      pivot.add(mesh);
      this.bookGroup.add(pivot);
      this.pagePivots.push(pivot);
      this.pageMaterials.push(material);
    }

    // --- front cover (pivots on the left spine edge, swings on Y like a real book) ---
    // The pivot sits at the spine so rotating coverGroup around Y flips the
    // cover backward over the book, the same way a page turns. Z is set so
    // that the cover sits above the page stack when the book is closed
    // (hiding the pages underneath). During goToOpen the cover slides down
    // to coverZOpen, which is below the page stack — so once open, the
    // pages rest on top of the cover instead of the cover on top of the pages.
    this.coverZClosed = zStep * pageCount + 0.010;
    // Below the page stack (max page z is zStep * (pageCount - 1)) with a
    // small clearance so pages sit clearly on top of the cover.
    this.coverZOpen = -0.02;

    this.coverGroup.position.set(
      -bookWidth / 2 + 0.04,
      0,
      this.coverZClosed,
    );

    const frontCover = new THREE.Mesh(
      new THREE.BoxGeometry(bookWidth, bookHeight, 0.06),
      coverMaterial,
    );
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
    this.coverGroup.rotation.set(0, 0, 0);
  }

  /**
   * Build a ShaderMaterial that lights the page like a standard material
   * but adds a leading-edge curl during the turn. The curl is driven by:
   *   uProgress  - 0..1, how far the page is through its rotation
   *   uCurl      - peak Z-displacement of the leading edge
   *
   * Geometry is PlaneGeometry(w, h, 32, 1), so 'uv.x' goes 0 (spine) -> 1
   * (outer edge). During the first half of the turn (progress 0..0.5) the
   * outer edge is lifting; during the second half it is settling. We bias
   * the curl toward whichever half is "in motion".
   */
  private makePageCurlMaterial(pageColor: number): THREE.ShaderMaterial {
    const baseColor = new THREE.Color(pageColor);

    const uniforms: Record<string, THREE.IUniform> = {
      uBaseColor: { value: baseColor },
      uProgress: { value: 0 },
      uCurl: { value: 0.18 },
      uFlip: { value: 0 }, // 0 = right-to-left turn (uv.x rising curl),
                           // 1 = left-to-right return
      uLightDir: { value: new THREE.Vector3(4, 6, 5).normalize() },
      uAmbient: { value: 0.55 },
      uKey: { value: 1.6 },
      uRimColor: { value: new THREE.Color(0x6688ff) },
      uRimDir: { value: new THREE.Vector3(-5, 3, -4).normalize() },
    };

    const vertexShader = /* glsl */ `
      uniform float uProgress;
      uniform float uCurl;
      uniform float uFlip;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;

        // Distance from the spine edge (uv.x == 0). The leading edge is at
        // uv.x == 1. We compute a curl that lifts this edge during the
        // first half of the turn, then lets it settle.
        float edge = uv.x;

        // Lift peaks at progress = 0.5, falls to 0 at progress = 0 and 1.
        float lift = sin(uProgress * 3.14159265);

        // The curl tapers off as you move from the leading edge back toward
        // the spine. A smoothstep gives a soft falloff.
        float falloff = smoothstep(0.0, 0.55, edge);
        float liftForEdge = lift * falloff * uCurl;

        // For the return turn (uFlip == 1) the leading edge is now the
        // spine side, so the curl is highest near edge == 0.
        float falloffFlip = 1.0 - smoothstep(0.45, 1.0, edge);
        float liftForEdgeFlip = lift * falloffFlip * uCurl;

        float z = mix(liftForEdge, liftForEdgeFlip, uFlip);

        // Subtle lateral wave so the page bends like a sheet of paper, not a
        // rigid ramp. A small sine of edge multiplied by lift gives a soft
        // curl along the length.
        z += sin(edge * 3.14159265) * lift * 0.04;

        vec3 displaced = position + vec3(0.0, 0.0, z);

        vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
        vWorldPos = worldPos.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const fragmentShader = /* glsl */ `
      uniform vec3 uBaseColor;
      uniform vec3 uLightDir;
      uniform vec3 uRimColor;
      uniform vec3 uRimDir;
      uniform float uAmbient;
      uniform float uKey;
      uniform float uProgress;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      void main() {
        vec3 N = normalize(vNormalW);

        float ndl = max(dot(N, uLightDir), 0.0);
        vec3 diffuse = uBaseColor * (uAmbient + uKey * ndl);

        float rim = max(dot(N, uRimDir), 0.0);
        vec3 rimC = uRimColor * rim * 0.35;

        // Subtle page texture: a faint vignette near the spine so the page
        // doesn't look like a perfectly flat painted rectangle.
        float vignette = 1.0 - 0.12 * smoothstep(0.0, 0.15, vUv.x)
                              * (1.0 - smoothstep(0.85, 1.0, vUv.x));
        vec3 col = (diffuse + rimC) * vignette;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
    });

    return mat;
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

    switch (this.state) {
      case 'closed':
        this.goToOpen();
        break;
      case 'open':
        this.goToMiddle();
        break;
      case 'middle':
        this.goToClosed();
        break;
    }
  }

  // -------------------------------------------------------------------
  // state transitions
  // -------------------------------------------------------------------

  /**
   * Closed → Open: swing the cover open and turn pages 0..1 so the book
   * shows a clean left + right spread.
   */
  private goToOpen(): void {
    this.isAnimating = true;
    if (this.renderer) this.renderer.domElement.style.cursor = 'wait';

    const tl = gsap.timeline({
      onComplete: () => {
        this.state = 'open';
        this.isAnimating = false;
        if (this.renderer) this.renderer.domElement.style.cursor = 'grab';
        this.updateHint();
      },
    });

    // Cover swings open on the spine Y-axis, like a real book opening
    // backward. It travels -PI (180°) to lie flat against the back cover.
    tl.to(
      this.coverGroup.rotation,
      { y: -Math.PI, duration: 1.0, ease: 'power2.inOut' },
      0,
    );

    // Slide the cover down through the page layer so it ends up resting
    // underneath the pages. Combined with the Y rotation, this looks like
    // the cover is being lowered onto the back cover as it opens — and
    // once it's underneath, the turned pages sit cleanly on top of it.
    tl.to(
      this.coverGroup.position,
      { z: this.coverZOpen, duration: 1.0, ease: 'power2.inOut' },
      0,
    );

    // First two pages turn (one already moved with the cover via visual
    // perception; turn an extra page or two for a clear spread).
    const turnDuration = 0.9;
    const stagger = 0.08;
    const pagesToTurn = [0, 1];

    pagesToTurn.forEach((idx, i) => {
      const pivot = this.pagePivots[idx];
      const mat = this.pageMaterials[idx];

      tl.to(
        pivot.rotation,
        { y: -Math.PI, duration: turnDuration, ease: 'power2.inOut' },
        0.1 + i * stagger,
      );
      // Drive the curl shader: progress 0 -> 1 during the turn, "right-to-left".
      tl.to(
        mat.uniforms['uProgress'],
        {
          value: 1,
          duration: turnDuration,
          ease: 'power2.inOut',
          onStart: () => {
            mat.uniforms['uFlip'].value = 0;
          },
        },
        0.1 + i * stagger,
      );
    });

    // Settle the camera slightly toward a front-on view so both pages are
    // clearly visible, but only if the user hasn't dragged recently.
    this.tweenCameraAzimuthTo(0, 0.9);
  }

  /**
   * Open → Middle: turn the remaining pages so the book is opened to a
   * middle spread. With pageCount = 4 and 2 already turned, pages 2 and 3
   * turn next, leaving 2 on the left and 2 on the right.
   */
  private goToMiddle(): void {
    this.isAnimating = true;
    if (this.renderer) this.renderer.domElement.style.cursor = 'wait';

    const tl = gsap.timeline({
      onComplete: () => {
        this.state = 'middle';
        this.isAnimating = false;
        if (this.renderer) this.renderer.domElement.style.cursor = 'grab';
        this.updateHint();
      },
    });

    const turnDuration = 0.9;
    const stagger = 0.08;
    const pagesToTurn = [2, 3];

    pagesToTurn.forEach((idx, i) => {
      const pivot = this.pagePivots[idx];
      const mat = this.pageMaterials[idx];

      tl.to(
        pivot.rotation,
        { y: -Math.PI * 2, duration: turnDuration, ease: 'power2.inOut' },
        0.1 + i * stagger,
      );
      tl.to(
        mat.uniforms['uProgress'],
        {
          value: 1,
          duration: turnDuration,
          ease: 'power2.inOut',
          onStart: () => {
            mat.uniforms['uFlip'].value = 0;
          },
        },
        0.1 + i * stagger,
      );
    });
  }

  /**
   * Middle → Closed: turn every page back to the right side and close the
   * cover.
   */
  private goToClosed(): void {
    this.isAnimating = true;
    if (this.renderer) this.renderer.domElement.style.cursor = 'wait';

    const tl = gsap.timeline({
      onComplete: () => {
        this.state = 'closed';
        this.isAnimating = false;
        if (this.renderer) this.renderer.domElement.style.cursor = 'grab';
        this.updateHint();
      },
    });

    // Swing the cover back shut on the spine Y-axis, and slide it back
    // up above the page stack so it visually hides the pages again.
    tl.to(
      this.coverGroup.rotation,
      { y: 0, duration: 1.0, ease: 'power2.inOut' },
      0.1,
    );
    tl.to(
      this.coverGroup.position,
      { z: this.coverZClosed, duration: 1.0, ease: 'power2.inOut' },
      0.1,
    );

    const turnDuration = 0.9;
    const stagger = 0.08;

    // Reverse-order so the rightmost page settles first, mimicking how a
    // hand closes a book from the top of the stack.
    this.pagePivots.forEach((pivot, idx) => {
      const mat = this.pageMaterials[idx];
      const reverseOrder = this.pagePivots.length - 1 - idx;

      tl.to(
        pivot.rotation,
        {
          y: 0,
          duration: turnDuration,
          ease: 'power2.inOut',
        },
        0.1 + reverseOrder * stagger,
      );
      // Drive the curl for the return turn: flip direction so the leading
      // edge is now the spine side.
      tl.to(
        mat.uniforms['uProgress'],
        {
          value: 1,
          duration: turnDuration,
          ease: 'power2.inOut',
          onStart: () => {
            mat.uniforms['uFlip'].value = 1;
          },
        },
        0.1 + reverseOrder * stagger,
      );
    });
  }

  /**
   * Gentle camera nudge so the open/middle states frame both pages
   * symmetrically. Only nudges; user drag is unaffected (they can pull it
   * right back).
   */
  private tweenCameraAzimuthTo(target: number, duration: number): void {
    // If the user has rotated significantly, leave the camera alone.
    if (Math.abs(this.cameraAzimuth - target) > 1.0) return;

    gsap.to(this, {
      cameraAzimuth: target,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => this.updateCameraPosition(),
    });
  }

  private updateHint(): void {
    const hint = document.getElementById('hint');
    if (!hint) return;
    const next: Record<BookState, string> = {
      closed: 'Click the book to open it.',
      open: 'Click again to turn to the middle.',
      middle: 'Click again to close the book.',
    };
    hint.textContent = next[this.state];
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