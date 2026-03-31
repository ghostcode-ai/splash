// ═══════════════════════════════════════════════════════════════════════════════
// SPECTRAL DATAFLOW v3 — Manual projection, continuous zoom, density scaling
// ═══════════════════════════════════════════════════════════════════════════════

const VOID = [5, 5, 16] as const;
const MIDNIGHT = [10, 15, 46] as const;
const STEEL = [26, 39, 68] as const;
const DUSTY = [59, 89, 152] as const;
const MOONLIT = [126, 184, 224] as const;
const ICE = [200, 224, 255] as const;
const PEAK = [255, 255, 255] as const;
const CYAN = [0, 200, 255] as const;

type RGB = readonly [number, number, number];
// ASCII only for perf — CJK glyphs are expensive to render
const CHARS = '0110100101 GHOST CODE AI {fn}=>[void] 0xDEAD /|<>+{}[]';

// ═══════════════════════════════════════════════════════════════════════════════
// MATH
// ═══════════════════════════════════════════════════════════════════════════════

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function smin(a: number, b: number, k: number) {
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}
function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))] as unknown as RGB;
}
function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1)})`;
}
function colorRamp(t: number): RGB {
  const c = clamp(t, 0, 1);
  if (c < 0.2) return lerpRGB(VOID, MIDNIGHT, c / 0.2);
  if (c < 0.4) return lerpRGB(MIDNIGHT, STEEL, (c - 0.2) / 0.2);
  if (c < 0.6) return lerpRGB(STEEL, MOONLIT, (c - 0.4) / 0.2);
  if (c < 0.85) return lerpRGB(MOONLIT, ICE, (c - 0.6) / 0.25);
  return lerpRGB(ICE, PEAK, (c - 0.85) / 0.15);
}
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GHOST SDF
// ═══════════════════════════════════════════════════════════════════════════════

interface SDFResult {
  dist: number;
  mask: number;
  eyeMask: number;
  rim: number;
  glow: number;
}

function ghostSDF(
  px: number, py: number,
  cx: number, cy: number,
  scale: number, time: number,
  velX: number,
): SDFResult {
  let qx = (px - cx) / scale;
  let qy = (py - cy) / scale;

  // TILT the whole ghost ~8 degrees right for personality
  const tiltAngle = 0.14;
  const cs = Math.cos(tiltAngle), sn = Math.sin(tiltAngle);
  const rx = qx * cs - qy * sn;
  const ry = qx * sn + qy * cs;
  qx = rx;
  qy = ry;

  // Wind trailing: bottom shifts opposite to movement direction
  const windShift = velX * -0.002;

  // ── HEAD: large rounded dome — the widest part ──
  const headRx = 0.26;  // wide dome
  const headRy = 0.20;  // slightly squashed
  const headCY = -0.06;
  const hx = qx / headRx;
  const hy = (qy - headCY) / headRy;
  const head = Math.sqrt(hx * hx + hy * hy) - 1.0;

  // ── BODY: draped sheet flowing down, narrowing slightly ──
  const bodyTop = 0.10;
  const bodyBot = 0.52;
  const bodyT = clamp((qy - bodyTop) / (bodyBot - bodyTop), 0, 1);
  // Width: starts at head width, tapers to ~65%
  const bodyHW = headRx * (1.0 - bodyT * 0.35);
  // Apply wind shift that increases toward bottom
  const windedX = qx - windShift * bodyT * bodyT;
  const body = (qy < bodyTop || qy > bodyBot) ? 999 : (Math.abs(windedX) / bodyHW - 1.0);

  // ── SMOOTH UNION: dome flows into body ──
  let shape = smin(head, body, 0.12);

  // ── WAVY HEM: flowing fabric bottom — multiple layered waves ──
  const waveAmp = 0.04 + Math.sin(time * 0.5) * 0.012;
  const wave = Math.sin(qx * 8 + time * 2.0) * waveAmp
             + Math.sin(qx * 14 - time * 1.5) * waveAmp * 0.5
             + Math.sin(qx * 4 + time * 0.6) * waveAmp * 0.8
             + Math.sin(qx * 20 + time * 2.8) * waveAmp * 0.2; // fine flutter
  const bottomEdge = bodyBot + wave + windShift * 0.4 * Math.sin(qx * 4 + time);
  shape = Math.max(shape, qy - bottomEdge);

  // ── CUT ABOVE HEAD ──
  shape = Math.max(shape, -(qy + 0.30));

  // ── LIVING EDGE: body sides ripple like fabric breathing ──
  // Stronger deformation lower in the body (top stays stable, bottom flows)
  const bodyDepth = clamp((qy - bodyTop) / (bodyBot - bodyTop), 0, 1);
  const edgeRipple = bodyDepth * bodyDepth * (
    Math.sin(qy * 12 + time * 2.2) * 0.012
    + Math.sin(qy * 20 - time * 1.6) * 0.006
    + Math.sin(qy * 8 + qx * 5 + time * 1.0) * 0.008
  );
  shape += edgeRipple;

  // Fine organic noise on all edges
  shape += Math.sin(qx * 22 + qy * 12 + time * 1.3) * 0.004
         + Math.sin(qy * 30 - time * 2.0) * 0.002;

  // ── EYES: two ovals in the head dome ──
  const eyeSp = 0.085;
  const eyCY = 0.0;   // centered in the head
  const eyRx = 0.05;
  const eyRy = 0.055;
  // Slight asymmetry — left eye slightly higher
  const elx = (qx + eyeSp) / eyRx;
  const ely = (qy - eyCY + 0.01) / eyRy;
  const erx = (qx - eyeSp) / eyRx;
  const ery = (qy - eyCY) / eyRy;
  const eyeDist = Math.min(
    Math.sqrt(elx * elx + ely * ely) - 1.0,
    Math.sqrt(erx * erx + ery * ery) - 1.0,
  );

  const mask = smoothstep(0.015, -0.015, shape);
  const eyeMask = smoothstep(0.01, -0.01, eyeDist);

  // RIM LIGHTING
  const rimW = 0.08;
  const depth = clamp(-shape / rimW, 0, 1);
  const edgeBright = 1.0 - depth * 0.7;
  const rimBand = Math.exp(-depth * 3.0) * 0.3;
  const rim = mask * (0.25 + edgeBright * 0.5 + rimBand) * (1.0 - eyeMask * 0.97);

  // GLOW
  const glow = Math.exp(-Math.max(shape, 0) * 5.0) * 0.7;

  return { dist: shape, mask, eyeMask, rim, glow };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export type PhaseCallback = (phase: string) => void;

export class SplashEngine {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private rand = mulberry32(42);
  private time = 0;
  private progress = 0; // 0→1 continuous animation progress
  private animId = 0;
  private lastFrame = 0;
  private onPhase: PhaseCallback | null = null;
  private landingFired = false;
  private frameCount = 0;

  // Ghost world-space
  private ghostWorldX = 0;
  private ghostWorldY = 0;
  private ghostWorldScale = 100;
  private ghostBaseX = 0;
  private ghostBaseY = 0;
  private ghostVelX = 0;
  private ghostPrevX = 0;

  // Puddle world-space
  private puddleWorldY = 0;

  // Camera — virtual 3D position for parallax
  private camZoom = 1;
  private camFocusX = 0;
  private camFocusY = 0;
  private camTilt = 0;     // 0 = front view, 1 = fully overhead
  private camOrbitX = 0;   // lateral offset for fly-around effect

  // Row seeds for consistent scrolling
  private rowSeeds: number[] = [];

  // Bitmap character atlas for fast rendering
  private atlas!: HTMLCanvasElement;
  private glyphW = 0;
  private glyphH = 0;
  private atlasChars: string[] = [];

  // ── LOOP STATE: ghost flythrough after clicking GHOSTCODE ──
  private loopState: 'intro' | 'masked' | 'flythrough' | 'waiting' = 'intro';
  private loopTime = 0;             // time within current loop state
  private maskOpacity = 0;          // current mask visibility (animated)
  // Flythrough path
  private flyStartX = 0;
  private flyStartY = 0;
  private flyEndX = 0;
  private flyEndY = 0;
  private flyCtrlX = 0;            // bezier control point
  private flyCtrlY = 0;
  private flyDuration = 5;
  private titleFontSize = 0;       // cached for hit testing

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('No 2D');
    this.ctx = ctx;
  }

  onPhaseChange(cb: PhaseCallback) { this.onPhase = cb; }

  init() {
    this.dpr = 1; // force 1x for performance until we optimize
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.ghostWorldScale = Math.min(this.w, this.h) * 0.35;
    this.ghostBaseX = this.w * 0.5;
    this.ghostBaseY = this.h * 0.32;
    this.ghostWorldX = this.ghostBaseX;
    this.ghostWorldY = this.ghostBaseY;
    this.ghostPrevX = this.ghostWorldX;

    this.puddleWorldY = this.h * 0.73;

    this.camFocusX = this.w / 2;
    this.camFocusY = this.h * 0.45;

    // Click + cursor handling
    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);

    // Pre-generate row seeds
    this.rand = mulberry32(42);
    this.rowSeeds = [];
    for (let i = 0; i < 500; i++) {
      this.rowSeeds.push(this.rand() * 100000);
    }

    // Build bitmap character atlas — one white glyph per character
    this.buildAtlas();
  }

  private buildAtlas() {
    // Deduplicate CHARS (skip spaces)
    const unique = [...new Set(CHARS.split(''))].filter(c => c !== ' ');
    this.atlasChars = unique;
    this.glyphW = 14;
    this.glyphH = 18;

    const cols = unique.length;
    this.atlas = document.createElement('canvas');
    this.atlas.width = cols * this.glyphW;
    this.atlas.height = this.glyphH;
    const actx = this.atlas.getContext('2d')!;

    actx.font = '12px "Space Mono",monospace';
    actx.textBaseline = 'top';
    actx.fillStyle = '#ffffff'; // white — we'll tint via globalAlpha + compositing

    for (let i = 0; i < unique.length; i++) {
      actx.fillText(unique[i], i * this.glyphW + 1, 1);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERACTION: click GHOSTCODE to trigger ghost flythrough
  // ═══════════════════════════════════════════════════════════════════

  private isOverTitle(mx: number, my: number): boolean {
    if (this.loopState !== 'masked' || this.maskOpacity < 0.5) return false;
    // Hit test against the GHOSTCODE text bounds
    const cx = this.w / 2;
    const cy = this.h / 2;
    const halfW = this.w * 0.42;
    const halfH = this.titleFontSize * 0.55;
    return mx > cx - halfW && mx < cx + halfW && my > cy - halfH && my < cy + halfH;
  }

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    this.canvas.style.cursor = this.isOverTitle(mx, my) ? 'pointer' : 'default';
  };

  private handleClick = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (this.isOverTitle(mx, my)) {
      this.startFlythrough();
    }
  };

  private startFlythrough() {
    this.loopState = 'flythrough';
    this.loopTime = 0;

    const { w, h } = this;
    const gs = Math.min(w, h) * 0.35;
    const margin = gs * 1.5;
    const r = Math.random;

    // Pick random entry point on a random edge
    const edges = ['top', 'right', 'bottom', 'left'] as const;
    const entryEdge = edges[Math.floor(r() * 4)];

    const edgePoint = (edge: string): [number, number] => {
      const off = 0.2 + r() * 0.6;
      switch (edge) {
        case 'top':    return [w * off, -margin];
        case 'bottom': return [w * off, h + margin];
        case 'left':   return [-margin, h * off];
        case 'right':  return [w + margin, h * off];
        default:       return [w * 0.5, -margin];
      }
    };

    [this.flyStartX, this.flyStartY] = edgePoint(entryEdge);

    // EXIT: find the screen vertex (corner) farthest from start
    const corners: [number, number][] = [[0, 0], [w, 0], [w, h], [0, h]];
    let farCorner = corners[0];
    let farDist = 0;
    for (const c of corners) {
      const d = Math.sqrt((c[0] - this.flyStartX) ** 2 + (c[1] - this.flyStartY) ** 2);
      if (d > farDist) { farDist = d; farCorner = c; }
    }

    // Pick a random point on one of the two edges meeting at that corner,
    // no more than halfway along that edge
    const [cx, cy] = farCorner;
    // The two edges from this corner
    const edgesFromCorner: [number, number][][] = [];
    if (cy === 0) { // top edge
      edgesFromCorner.push([[cx, 0], [cx === 0 ? w * 0.5 : cx - w * 0.5, 0]]);
    } else { // bottom edge
      edgesFromCorner.push([[cx, h], [cx === 0 ? w * 0.5 : cx - w * 0.5, h]]);
    }
    if (cx === 0) { // left edge
      edgesFromCorner.push([[0, cy], [0, cy === 0 ? h * 0.5 : cy - h * 0.5]]);
    } else { // right edge
      edgesFromCorner.push([[w, cy], [w, cy === 0 ? h * 0.5 : cy - h * 0.5]]);
    }

    // Pick one of the two edges randomly, then a random point up to 50% along it
    const chosenEdge = edgesFromCorner[Math.floor(r() * edgesFromCorner.length)];
    const along = r() * 0.5; // 0–50% from the corner
    this.flyEndX = lerp(chosenEdge[0][0], chosenEdge[1][0], along) + (Math.abs(chosenEdge[0][0] - w / 2) > w / 4 ? Math.sign(chosenEdge[0][0] - w / 2) * margin : 0);
    this.flyEndY = lerp(chosenEdge[0][1], chosenEdge[1][1], along) + (Math.abs(chosenEdge[0][1] - h / 2) > h / 4 ? Math.sign(chosenEdge[0][1] - h / 2) * margin : 0);

    // Push exit point off-screen along the edge direction
    const exitDx = this.flyEndX - w / 2;
    const exitDy = this.flyEndY - h / 2;
    const exitLen = Math.sqrt(exitDx * exitDx + exitDy * exitDy) || 1;
    this.flyEndX += (exitDx / exitLen) * margin;
    this.flyEndY += (exitDy / exitLen) * margin;

    // Control point: perpendicular offset from midpoint for a curved arc
    const midX = (this.flyStartX + this.flyEndX) / 2;
    const midY = (this.flyStartY + this.flyEndY) / 2;
    const pathDx = this.flyEndX - this.flyStartX;
    const pathDy = this.flyEndY - this.flyStartY;
    const perpDir = r() > 0.5 ? 1 : -1;
    this.flyCtrlX = clamp(midX + (-pathDy * 0.35 * perpDir), w * 0.1, w * 0.9);
    this.flyCtrlY = clamp(midY + (pathDx * 0.35 * perpDir), h * 0.1, h * 0.9);

    this.flyDuration = 12 + r() * 5; // 20% slower (12–17s)
  }

  /** Fast character stamp using the atlas. Color is baked via globalAlpha + filter. */
  private stampChar(ctx: CanvasRenderingContext2D, charIdx: number, x: number, y: number, color: RGB, alpha: number) {
    if (alpha < 0.01) return;
    const idx = charIdx % this.atlasChars.length;
    const sx = idx * this.glyphW;

    ctx.globalAlpha = alpha;
    // Tint: draw white glyph, then overlay color
    // For speed, we just set globalAlpha and use 'source-atop' compositing
    // Simpler: just draw with alpha, accept white glyphs tinted by background blend
    ctx.drawImage(this.atlas, sx, 0, this.glyphW, this.glyphH, x, y, this.glyphW, this.glyphH);
    ctx.globalAlpha = 1;
  }

  start() {
    this.lastFrame = performance.now();
    this.time = 0;
    this.progress = 0;
    this.landingFired = false;
    this.ctx.fillStyle = rgba(VOID, 1);
    this.ctx.fillRect(0, 0, this.w, this.h);
    this.loop();
  }

  stop() { if (this.animId) cancelAnimationFrame(this.animId); }
  destroy() {
    this.stop();
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
  }

  private loop = () => {
    try {
      const now = performance.now();
      const dt = Math.min((now - this.lastFrame) / 1000, 2.0); // allow large steps for slow frames
      this.lastFrame = now;
      this.time += dt;

      // Progress: 0→1 is the main animation (22s), continues past 1.0 for outro
      this.progress = this.time / 22;

      // Track time within current loop state
      this.loopTime += dt;

      this.updateCamera();
      this.updateGhost(dt);
      this.render();

      if (this.progress >= 0.95 && !this.landingFired) {
        this.landingFired = true;
        this.onPhase?.('landing');
      }
    } catch (e) {
      console.error('Engine loop error:', e);
    }
    this.animId = requestAnimationFrame(this.loop);
  };

  // ═══════════════════════════════════════════════════════════════════
  // CAMERA — continuous, always keeps ghost + puddle in frame
  // ═══════════════════════════════════════════════════════════════════

  private updateCamera() {
    const p = this.progress;

    // ── DRONE FLIGHT PATH ──
    // Single continuous curves — no seams or velocity discontinuities.

    // Lateral orbit: sweep right → center → slight left
    const orbitT = smoothstep(0.0, 0.65, p);
    this.camOrbitX = lerp(this.w * 0.18, -this.w * 0.03, orbitT);

    // Tilt: front-on during orbit, rises for overhead dive
    this.camTilt = smoothstep(0.35, 0.92, p);

    // Zoom: single continuous ease-in curve (slow start, accelerating)
    // Overshoots slightly past 1.0 so the final state is still moving when it ends
    const zoomT = smoothstep(0, 1.05, p); // extends past p=1.0
    const zoomEased = zoomT * zoomT * (0.6 + zoomT * 1.4);
    this.camZoom = 1.0 + zoomEased;

    // Vertical focus: overshoots past puddle so camera is still drifting down at the end
    const ghostY = this.ghostWorldY;
    const puddleY = this.puddleWorldY;
    const beyondPuddle = puddleY + (puddleY - ghostY) * 0.15; // target slightly past puddle
    const focusT = smoothstep(0.08, 1.05, p); // extends past p=1.0
    this.camFocusY = lerp(ghostY, beyondPuddle, focusT);
    this.camFocusX = this.w / 2;
  }

  // ═══════════════════════════════════════════════════════════════════
  // GHOST ANIMATION
  // ═══════════════════════════════════════════════════════════════════

  private updateGhost(dt: number) {
    const t = this.time;
    const p = this.progress;
    this.ghostPrevX = this.ghostWorldX;

    // Ghost drifts down toward puddle
    const approachT = smoothstep(0.1, 0.6, p);
    this.ghostBaseY = lerp(this.h * 0.30, this.h * 0.50, approachT);

    // --- LIFELIKE MOTION ---
    // Layered organic movement: slow drift + medium bob + fast micro-jitter
    const floatScale = 1.0 - p * 0.5;

    // Slow drift (like floating in still air)
    const driftX = Math.sin(t * 0.2) * 25 + Math.sin(t * 0.53) * 12;
    // Breathing bob — slightly irregular, like a living thing
    const breathe = Math.sin(t * 0.45) * 14 + Math.sin(t * 0.83) * 6 + Math.sin(t * 1.7) * 2;
    // Subtle lateral sway (weight shifting)
    const sway = Math.sin(t * 0.35) * 8 * Math.sin(t * 0.12);

    this.ghostWorldX = this.ghostBaseX + (driftX + sway) * floatScale;
    this.ghostWorldY = this.ghostBaseY + breathe * floatScale;
    this.ghostVelX = (this.ghostWorldX - this.ghostPrevX) / Math.max(dt, 0.001);

    // Breathing scale: ghost subtly expands/contracts like it's alive
    const breatheScale = 1.0 + Math.sin(t * 0.5) * 0.015 + Math.sin(t * 1.3) * 0.005;
    this.ghostWorldScale = Math.min(this.w, this.h) * 0.35 * breatheScale;
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORLD → SCREEN projection with parallax
  // depth: 0 = ground plane (puddle), 1 = floating (ghost)
  // Higher depth = more lateral shift from camera orbit (closer = more parallax)
  // ═══════════════════════════════════════════════════════════════════

  private toScreen(wx: number, wy: number, depth: number = 0): [number, number] {
    // Parallax: objects closer to camera (higher depth) shift more with orbit
    const parallaxFactor = 1.0 + depth * 0.6;
    const orbitShift = this.camOrbitX * parallaxFactor;

    const sx = (wx - this.camFocusX + orbitShift) * this.camZoom + this.w / 2;
    const sy = (wy - this.camFocusY) * this.camZoom + this.h / 2;
    return [sx, sy];
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  private render() {
    const ctx = this.ctx;
    const p = this.progress;
    const t = this.time;

    ctx.fillStyle = rgba(VOID, 1);
    ctx.fillRect(0, 0, this.w, this.h);

    this.renderGround(ctx);

    // ── LOOP STATE MACHINE ──
    this.updateLoopState();

    // Puddle is always visible once it fades in
    const puddleOp = clamp(smoothstep(0.03, 0.15, p), 0, 1);

    if (this.loopState === 'intro') {
      // Original intro animation
      const ghostVisible = 1.0 - smoothstep(0.82, 0.92, p);
      const reflectionVisible = 1.0 - smoothstep(0.90, 1.0, p);

      if (puddleOp > 0.01) this.renderPuddle(ctx, puddleOp, reflectionVisible, 1.0);

      if (ghostVisible > 0.01) {
        this.renderGhostGlow(ctx);
        this.renderGhost(ctx, ghostVisible);
      }

      this.renderVignette(ctx);

      // Title mask fades in at end of intro
      const titleVis = smoothstep(1.25, 1.4, p);
      if (titleVis > 0.01) {
        this.maskOpacity = titleVis;
        this.renderTitleMask(ctx, this.maskOpacity);
      }
    } else if (this.loopState === 'masked') {
      // Steady state: puddle + mask
      if (puddleOp > 0.01) this.renderPuddle(ctx, puddleOp, 0, 1.0);
      this.renderVignette(ctx);
      this.renderTitleMask(ctx, this.maskOpacity);

    } else if (this.loopState === 'flythrough') {
      // Mask fading out + ghost flying through
      if (puddleOp > 0.01) this.renderPuddle(ctx, puddleOp, 0, 1.0);

      // Ghost on its flythrough path
      const ft = clamp(this.loopTime / this.flyDuration, 0, 1);
      this.renderFlythroughGhost(ctx, ft);

      this.renderVignette(ctx);

      // Mask fades out over first 1.5s of flythrough
      this.maskOpacity = clamp(1.0 - this.loopTime / 1.5, 0, 1);
      if (this.maskOpacity > 0.01) {
        this.renderTitleMask(ctx, this.maskOpacity);
      }

    } else if (this.loopState === 'waiting') {
      // Ghost gone, waiting 3s, then mask fades back in
      if (puddleOp > 0.01) this.renderPuddle(ctx, puddleOp, 0, 1.0);
      this.renderVignette(ctx);

      // Mask fades back in after 2s wait
      this.maskOpacity = smoothstep(2.0, 3.5, this.loopTime);
      if (this.maskOpacity > 0.01) {
        this.renderTitleMask(ctx, this.maskOpacity);
      }
    }

    this.frameCount++;
  }

  private updateLoopState() {
    if (this.loopState === 'intro') {
      // Transition to 'masked' once title is fully visible
      if (this.progress > 1.5) {
        this.loopState = 'masked';
        this.maskOpacity = 1;
        this.loopTime = 0;
      }
    } else if (this.loopState === 'flythrough') {
      // Ghost finished its path?
      if (this.loopTime > this.flyDuration) {
        this.loopState = 'waiting';
        this.loopTime = 0;
      }
    } else if (this.loopState === 'waiting') {
      // Mask fully back? Return to masked state
      if (this.loopTime > 4.0) {
        this.loopState = 'masked';
        this.maskOpacity = 1;
        this.loopTime = 0;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FLYTHROUGH GHOST — bezier curve path across the screen
  // ═══════════════════════════════════════════════════════════════════

  private renderFlythroughGhost(ctx: CanvasRenderingContext2D, ft: number) {
    const t = this.time;

    // Variable speed: ft progresses unevenly (wanders faster/slower)
    const speedWobble = 1.0 + Math.sin(t * 0.7) * 0.12 + Math.sin(t * 1.3) * 0.06;
    // We don't actually remap ft (that would mess up duration), instead we
    // displace the position off the path to simulate wandering

    // Quadratic bezier: start → control → end
    const t1 = 1 - ft;
    let bx = t1 * t1 * this.flyStartX + 2 * t1 * ft * this.flyCtrlX + ft * ft * this.flyEndX;
    let by = t1 * t1 * this.flyStartY + 2 * t1 * ft * this.flyCtrlY + ft * ft * this.flyEndY;

    // Wandering: layered sine displacement perpendicular to path
    // Gives the ghost an organic, drifting, curious quality
    const wanderX = Math.sin(t * 0.3) * 30 + Math.sin(t * 0.7) * 15 + Math.sin(t * 1.4) * 6;
    const wanderY = Math.sin(t * 0.25) * 25 + Math.sin(t * 0.6) * 12 + Math.sin(t * 1.1) * 5;
    // Reduce wander near edges so ghost enters/exits cleanly
    const edgeDamp = Math.min(smoothstep(0, 0.15, ft), smoothstep(1, 0.85, ft));
    bx += wanderX * edgeDamp;
    by += wanderY * edgeDamp;

    // Save all state we'll override
    const saved = {
      gx: this.ghostWorldX,
      gy: this.ghostWorldY,
      gs: this.ghostWorldScale,
      vx: this.ghostVelX,
      zoom: this.camZoom,
      fx: this.camFocusX,
      fy: this.camFocusY,
      orbit: this.camOrbitX,
      tilt: this.camTilt,
    };

    // Set ghost position on bezier path
    this.ghostWorldX = bx;
    this.ghostWorldY = by;

    // Same scale as the intro ghost (before any zoom)
    this.ghostWorldScale = Math.min(this.w, this.h) * 0.35;

    // Velocity from path direction for dress trailing
    const dt = 0.01;
    const ft2 = Math.min(ft + dt, 1);
    const t2 = 1 - ft2;
    const nextBx = t2 * t2 * this.flyStartX + 2 * t2 * ft2 * this.flyCtrlX + ft2 * ft2 * this.flyEndX;
    this.ghostVelX = (nextBx - bx) / (this.flyDuration * dt);

    // Camera: simple centered view, no zoom/orbit/tilt — same as intro start
    this.camZoom = 1;
    this.camFocusX = this.w / 2;
    this.camFocusY = this.h / 2;
    this.camOrbitX = 0;
    this.camTilt = 0;

    // Smooth edge fade
    const edgeFade = Math.min(
      smoothstep(0, 0.12, ft),
      smoothstep(1.0, 0.88, ft),
    );

    // Shadow/reflection on the ground below the ghost
    this.renderFlythroughShadow(ctx, bx, by, edgeFade);

    this.renderGhostGlow(ctx);
    this.renderGhost(ctx, edgeFade);

    // Restore everything
    this.ghostWorldX = saved.gx;
    this.ghostWorldY = saved.gy;
    this.ghostWorldScale = saved.gs;
    this.ghostVelX = saved.vx;
    this.camZoom = saved.zoom;
    this.camFocusX = saved.fx;
    this.camFocusY = saved.fy;
    this.camOrbitX = saved.orbit;
    this.camTilt = saved.tilt;
  }

  // ═══════════════════════════════════════════════════════════════════
  // FLYTHROUGH SHADOW — reflection/shadow on ground below the ghost
  // ═══════════════════════════════════════════════════════════════════

  private renderFlythroughShadow(ctx: CanvasRenderingContext2D, gx: number, gy: number, opacity: number) {
    const gs = this.ghostWorldScale;
    const t = this.time;

    // Shadow sits on the "ground" below the ghost — vertically offset and squashed
    const shadowY = gy + gs * 0.7;  // below the ghost
    const shadowW = gs * 0.5;
    const shadowH = gs * 0.12;      // very squashed vertically (ground plane perspective)

    // Soft elliptical glow
    const grad = ctx.createRadialGradient(gx, shadowY, 0, gx, shadowY, shadowW);
    grad.addColorStop(0, rgba(MOONLIT, 0.08 * opacity));
    grad.addColorStop(0.4, rgba(DUSTY, 0.04 * opacity));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(gx - shadowW, shadowY - shadowH * 2, shadowW * 2, shadowH * 4);

    // Distorted text reflection inside the shadow ellipse
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(gx, shadowY, shadowW * 0.8, shadowH, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.font = '8px "Space Mono", monospace';
    ctx.textBaseline = 'top';
    const refText = 'GHOST CODE [void] 0xDEAD => spectral emergence ';
    const lineH = 10;

    for (let ry = shadowY - shadowH; ry < shadowY + shadowH; ry += lineH) {
      const ri = Math.floor(ry / lineH);
      const dx = Math.sin(ry * 0.08 + t * 1.5) * 5; // water distortion
      const off = (ri * 7 + Math.floor(t * 5)) % refText.length;
      const text = (refText.slice(off) + refText).slice(0, 60);
      const alpha = 0.2 * opacity * (1 - Math.abs(ry - shadowY) / shadowH);
      ctx.fillStyle = rgba(MOONLIT, alpha);
      ctx.fillText(text, gx - shadowW * 0.7 + dx, ry);
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════════
  // GHOST — horizontal text bands, density scales with screen size
  // ═══════════════════════════════════════════════════════════════════

  private renderGhost(ctx: CanvasRenderingContext2D, visibility: number = 1) {
    const { ghostWorldX: gwx, ghostWorldY: gwy, ghostWorldScale: gws, time: t, ghostVelX } = this;

    // Ghost screen position — depth=1 (floating, more parallax shift)
    const [gsx, gsy] = this.toScreen(gwx, gwy, 1);
    // Vertical compression: ghost squashes as camera goes overhead
    const perspCompressY = 1.0 - this.camTilt * 0.55;
    const gsScale = gws * this.camZoom;

    // Row/char spacing — balance density vs performance
    const ROW_SPACING = 16;
    const CHAR_SPACING_BASE = 14;

    // Ghost bounds on screen (compressed vertically by perspective)
    const yTop = gsy - gsScale * 0.45 * perspCompressY;
    const yBot = gsy + gsScale * 0.85 * perspCompressY;

    // Font sizes: fixed on screen for density
    const sizes = [9, 12, 17];
    const sizeWeights = [0.5, 0.35, 0.15]; // probability thresholds

    let rowIdx = 0;
    const charSpacing = CHAR_SPACING_BASE;

    for (let sy = yTop; sy < yBot; sy += ROW_SPACING) {
      rowIdx++;
      const seed = this.rowSeeds[rowIdx % this.rowSeeds.length];

      // Scroll direction alternates
      const dir = rowIdx % 2 === 0 ? 1 : -1;
      const speed = 15 + (seed % 30);
      const scrollX = dir * speed * t;

      // Scan across ghost width on screen
      const xLeft = gsx - gsScale * 0.35;
      const xRight = gsx + gsScale * 0.35;

      for (let sx = xLeft; sx < xRight; sx += charSpacing) {
        // Screen → world for SDF
        const wx = gwx + (sx - gsx) / this.camZoom;
        const wy = gwy + (sy - gsy) / (this.camZoom * perspCompressY);

        const sdf = ghostSDF(wx, wy, gwx, gwy, gws, t, ghostVelX);
        if (sdf.mask < 0.01 && sdf.glow < 0.02) continue;

        const ci = Math.abs(Math.floor((sx + scrollX + seed) / charSpacing));

        let alpha: number;
        let colorT: number;

        if (sdf.mask > 0.01) {
          alpha = 0.3 + sdf.rim * 0.7;
          colorT = 0.35 + sdf.rim * 0.6;
          if (sdf.eyeMask > 0.15) alpha *= 0.01;
          alpha *= 0.8 + (Math.sin(sy * 0.3 + t * 0.6) * 0.5 + 0.5) * 0.2;
        } else {
          alpha = sdf.glow * 0.3;
          colorT = 0.12 + sdf.glow * 0.3;
        }

        alpha *= visibility;
        if (alpha < 0.01) continue;

        // Use atlas stamp instead of fillText
        const color = colorRamp(colorT);
        this.stampChar(ctx, ci, sx, sy, color, alpha);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GHOST GLOW
  // ═══════════════════════════════════════════════════════════════════

  private renderGhostGlow(ctx: CanvasRenderingContext2D) {
    const [gsx, gsy] = this.toScreen(this.ghostWorldX, this.ghostWorldY, 1);
    const r = this.ghostWorldScale * this.camZoom * 0.7;

    const g1 = ctx.createRadialGradient(gsx, gsy, r * 0.05, gsx, gsy, r);
    g1.addColorStop(0, rgba(MOONLIT, 0.18));
    g1.addColorStop(0.25, rgba(DUSTY, 0.07));
    g1.addColorStop(0.6, rgba(MIDNIGHT, 0.02));
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.fillRect(gsx - r, gsy - r, r * 2, r * 2);

    const r2 = r * 0.45;
    const g2 = ctx.createRadialGradient(gsx, gsy - r2 * 0.2, 0, gsx, gsy, r2);
    g2.addColorStop(0, rgba(ICE, 0.1));
    g2.addColorStop(0.4, rgba(MOONLIT, 0.04));
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.fillRect(gsx - r2, gsy - r2, r2 * 2, r2 * 2);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUDDLE — grid of characters, ghost reflection
  // ═══════════════════════════════════════════════════════════════════

  private renderPuddle(ctx: CanvasRenderingContext2D, opacity: number, reflectionVis: number = 1, charFade: number = 1) {
    const t = this.time;
    const [pcx, pcy] = this.toScreen(this.w / 2, this.puddleWorldY);
    // Puddle grows dramatically — starts medium, fills screen at end
    const growT = smoothstep(0.1, 0.9, this.progress);
    const baseW = this.w * 0.35;
    const pw = (baseW + growT * this.w * 0.6) * this.camZoom;
    // Aspect ratio: starts foreshortened (0.25), becomes rounder as camera goes overhead (0.7)
    const aspect = lerp(0.25, 0.7, this.camTilt);
    const ph = pw * aspect;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Clip to organic ellipse
    ctx.beginPath();
    ctx.ellipse(pcx, pcy, pw, ph, 0, 0, Math.PI * 2);
    ctx.clip();

    // Background — brighter, more visible surface
    const bg = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, pw);
    bg.addColorStop(0, rgba(STEEL, 0.7));
    bg.addColorStop(0.4, rgba(MIDNIGHT, 0.5));
    bg.addColorStop(0.8, rgba(MIDNIGHT, 0.25));
    bg.addColorStop(1, rgba(VOID, 0.1));
    ctx.fillStyle = bg;
    ctx.fillRect(pcx - pw, pcy - ph, pw * 2, ph * 2);

    // (no stroke outline — puddle edge fades naturally via gradient)

    // Grid characters — atlas (cap visible area to screen for perf)
    const maxPW = Math.min(pw, this.w * 0.8);
    const maxPH = Math.min(ph, this.h * 0.6);
    const gridStep = 22;
    for (let gy = pcy - maxPH + 4; gy < pcy + maxPH; gy += gridStep) {
      const ri = Math.floor((gy - pcy + maxPH) / gridStep);
      const scroll = (ri % 2 === 0 ? 1 : -1) * t * 8;
      for (let gx = pcx - maxPW + 4; gx < pcx + maxPW; gx += gridStep) {
        const nx = (gx - pcx) / pw;
        const ny = (gy - pcy) / ph;
        const d2 = nx * nx + ny * ny;
        if (d2 > 0.92) continue;

        const ripple = Math.sin(Math.sqrt(d2) * pw * 0.05 - t * 2.5) * 0.25 + 0.75;
        const ci = Math.abs(Math.floor(gx * 0.08 + gy * 0.08 + scroll));
        const bright = (0.35 + ripple * 0.3) * (1 - d2 * 0.5);
        this.stampChar(ctx, ci, gx, gy, CYAN, bright * 0.85 * charFade);
      }
    }

    // Ghost reflection — dissolves after ghost fades
    if (reflectionVis > 0.01) {
      this.renderReflection(ctx, pcx, pcy, pw, ph, reflectionVis);
    }

    ctx.restore();
  }

  private renderReflection(
    ctx: CanvasRenderingContext2D,
    pcx: number, pcy: number, pw: number, ph: number,
    visibility: number = 1,
  ) {
    const { ghostWorldX: gwx, ghostWorldY: gwy, ghostWorldScale: gws, time: t, ghostVelX } = this;
    // Reflection uses ghost's screen X (with parallax) but puddle's depth
    const [gsx, gsyGhost] = this.toScreen(gwx, gwy, 0.5); // mid-depth for reflection

    // Reflection: larger, brighter, more visible
    const refCY = pcy + (pcy - gsyGhost) * 0.2;
    const refScale = gws * this.camZoom * 0.42;

    const step = 14;
    for (let ry = refCY - refScale * 0.4; ry < refCY + refScale * 0.7; ry += step) {
      const ri = Math.floor(ry / step);
      const scroll = (ri % 2 === 0 ? 1 : -1) * t * 12;
      for (let rx = gsx - refScale * 0.35; rx < gsx + refScale * 0.35; rx += step) {
        const nx = (rx - pcx) / pw;
        const ny = (ry - pcy) / ph;
        if (nx * nx + ny * ny > 0.85) continue;

        const sdf = ghostSDF(
          gwx + (rx - gsx) / (this.camZoom * 0.42),
          gwy + (ry - refCY) / (this.camZoom * 0.42),
          gwx, gwy, gws, t, ghostVelX,
        );
        if (sdf.mask < 0.1) continue;

        const dx = Math.sin(ry * 0.05 + t * 1.8) * 4;
        const dy = Math.sin(rx * 0.04 + t * 1.3) * 3;
        const ci = Math.abs(Math.floor(rx * 0.07 + scroll));
        const alpha = sdf.rim * 0.5 * visibility;
        this.stampChar(ctx, ci, rx + dx, ry + dy, MOONLIT, alpha);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GROUND + VIGNETTE
  // ═══════════════════════════════════════════════════════════════════

  private renderGround(ctx: CanvasRenderingContext2D) {
    const [, groundTop] = this.toScreen(0, this.h * 0.55);
    const grad = ctx.createLinearGradient(0, groundTop, 0, this.h);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, rgba(MIDNIGHT, 0.15));
    grad.addColorStop(1, rgba(MIDNIGHT, 0.25));
    ctx.fillStyle = grad;
    ctx.fillRect(0, Math.max(0, groundTop), this.w, this.h);
  }

  private renderVignette(ctx: CanvasRenderingContext2D) {
    const { w, h } = this;
    const r = Math.max(w, h) * 0.7;
    const grad = ctx.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, rgba(VOID, 0.75));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // ═══════════════════════════════════════════════════════════════════
  // TITLE MASK — "GHOSTCODE" masks the puddle chars underneath
  // The puddle grid keeps moving; only visible through letter shapes
  // ═══════════════════════════════════════════════════════════════════

  private titleCanvas: HTMLCanvasElement | null = null;
  private titleCtx: CanvasRenderingContext2D | null = null;

  private renderTitleMask(ctx: CanvasRenderingContext2D, visibility: number) {
    const { w, h } = this;

    // Lazy-create offscreen canvas for the dark overlay
    if (!this.titleCanvas || this.titleCanvas.width !== w) {
      this.titleCanvas = document.createElement('canvas');
      this.titleCanvas.width = w;
      this.titleCanvas.height = h;
      this.titleCtx = this.titleCanvas.getContext('2d')!;
    }
    const oc = this.titleCtx!;

    // Measure text to fit 80% screen width
    oc.font = '900 100px Impact, "Arial Narrow", Haettenschweiler, sans-serif';
    const measured = oc.measureText('GHOSTCODE');
    const fontSize = Math.round(100 * (w * 0.8 / measured.width));
    this.titleFontSize = fontSize; // cache for hit testing

    // Build the overlay on offscreen: solid dark with letter-shaped holes
    oc.clearRect(0, 0, w, h);
    oc.fillStyle = rgba(VOID, 0.92);
    oc.fillRect(0, 0, w, h);

    // Punch out letter shapes — reveals whatever is already on the main canvas
    oc.globalCompositeOperation = 'destination-out';
    oc.font = `900 ${fontSize}px Impact, "Arial Narrow", Haettenschweiler, sans-serif`;
    oc.textAlign = 'center';
    oc.textBaseline = 'middle';
    oc.fillStyle = 'white';
    oc.fillText('GHOSTCODE', w / 2, h / 2);
    oc.globalCompositeOperation = 'source-over';
    oc.textAlign = 'start';
    oc.textBaseline = 'alphabetic';

    // Composite: dark overlay with holes onto the main canvas
    // The puddle chars already drawn underneath show through the holes
    ctx.save();
    ctx.globalAlpha = visibility;
    ctx.drawImage(this.titleCanvas, 0, 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  getPhase() { return this.progress > 0.95 ? 'landing' : 'animating'; }
  isOverlayReady() { return this.landingFired; }
}
