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

  // ── WAVY HEM: continuous undulating bottom edge (like a sheet) ──
  const waveAmp = 0.035 + Math.sin(time * 0.6) * 0.008;
  const wave = Math.sin(qx * 9 + time * 1.8) * waveAmp
             + Math.sin(qx * 16 - time * 1.3) * waveAmp * 0.5
             + Math.sin(qx * 5 + time * 0.7) * waveAmp * 0.7;
  // Bottom with wind-shifted drape
  const bottomEdge = bodyBot + wave + windShift * 0.3 * Math.sin(qx * 4 + time);
  shape = Math.max(shape, qy - bottomEdge);

  // ── CUT ABOVE HEAD ──
  shape = Math.max(shape, -(qy + 0.30));

  // ── ORGANIC EDGE NOISE ──
  shape += Math.sin(qx * 18 + qy * 10 + time * 1.2) * 0.005
         + Math.sin(qy * 25 - time * 1.8) * 0.003;

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

  // Camera
  private camZoom = 1;
  private camFocusX = 0;
  private camFocusY = 0;
  private camTilt = 0; // 0 = front view, 1 = fully overhead

  // Row seeds for consistent scrolling
  private rowSeeds: number[] = [];

  // Bitmap character atlas for fast rendering
  private atlas!: HTMLCanvasElement;
  private glyphW = 0;
  private glyphH = 0;
  private atlasChars: string[] = [];

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
  destroy() { this.stop(); }

  private loop = () => {
    try {
      const now = performance.now();
      const dt = Math.min((now - this.lastFrame) / 1000, 2.0); // allow large steps for slow frames
      this.lastFrame = now;
      this.time += dt;

      // Continuous progress: 0→1 over ~22 seconds
      this.progress = clamp(this.time / 22, 0, 1);

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

    // Tilt: 0 (front/3-quarter) → 1 (overhead) — matches the video orbit
    this.camTilt = smoothstep(0.15, 0.9, p);

    // Zoom: increases as camera approaches, then goes big for puddle fill
    this.camZoom = 1.0 + smoothstep(0, 0.85, p) * 1.8;

    // Focus: shifts from ghost → puddle as we go overhead
    const ghostY = this.ghostWorldY;
    const puddleY = this.puddleWorldY;
    const focusT = smoothstep(0.1, 0.8, p);
    this.camFocusY = lerp(ghostY + (puddleY - ghostY) * 0.25, puddleY, focusT);
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

    // Organic float (reduces amplitude as we zoom in)
    const floatScale = 1.0 - p * 0.6;
    const driftX = (Math.sin(t * 0.25) * 20 + Math.sin(t * 0.6) * 8) * floatScale;
    const bobY = (Math.sin(t * 0.4) * 12 + Math.sin(t * 0.9) * 4) * floatScale;

    this.ghostWorldX = this.ghostBaseX + driftX;
    this.ghostWorldY = this.ghostBaseY + bobY;
    this.ghostVelX = (this.ghostWorldX - this.ghostPrevX) / Math.max(dt, 0.001);
  }

  // ═══════════════════════════════════════════════════════════════════
  // WORLD → SCREEN projection
  // ═══════════════════════════════════════════════════════════════════

  private toScreen(wx: number, wy: number): [number, number] {
    const sx = (wx - this.camFocusX) * this.camZoom + this.w / 2;
    const sy = (wy - this.camFocusY) * this.camZoom + this.h / 2;
    return [sx, sy];
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  private render() {
    const ctx = this.ctx;
    ctx.fillStyle = rgba(VOID, 1);
    ctx.fillRect(0, 0, this.w, this.h);

    this.renderGround(ctx);

    // Puddle (fades in early, grows to fill screen)
    const puddleOp = smoothstep(0.03, 0.15, this.progress);
    if (puddleOp > 0.01) this.renderPuddle(ctx, puddleOp);

    // Ghost (with perspective compression as camera tilts overhead)
    const ghostVisible = 1.0 - smoothstep(0.88, 1.0, this.progress); // fades at end
    if (ghostVisible > 0.01) {
      this.renderGhostGlow(ctx);
      this.renderGhost(ctx, ghostVisible);
    }

    this.renderVignette(ctx);

    // DEBUG
    this.frameCount++;
    ctx.fillStyle = 'lime';
    ctx.font = '14px monospace';
    ctx.fillText(`f=${this.frameCount} time=${this.time.toFixed(2)} p=${this.progress.toFixed(3)} z=${this.camZoom.toFixed(2)}`, 10, 20);
  }

  // ═══════════════════════════════════════════════════════════════════
  // GHOST — horizontal text bands, density scales with screen size
  // ═══════════════════════════════════════════════════════════════════

  private renderGhost(ctx: CanvasRenderingContext2D, visibility: number = 1) {
    const { ghostWorldX: gwx, ghostWorldY: gwy, ghostWorldScale: gws, time: t, ghostVelX } = this;

    // Ghost screen position and scale
    const [gsx, gsy] = this.toScreen(gwx, gwy);
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
    const [gsx, gsy] = this.toScreen(this.ghostWorldX, this.ghostWorldY);
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

  private renderPuddle(ctx: CanvasRenderingContext2D, opacity: number) {
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
        this.stampChar(ctx, ci, gx, gy, CYAN, bright * 0.85);
      }
    }

    // Ghost reflection
    this.renderReflection(ctx, pcx, pcy, pw, ph);

    ctx.restore();
  }

  private renderReflection(
    ctx: CanvasRenderingContext2D,
    pcx: number, pcy: number, pw: number, ph: number,
  ) {
    const { ghostWorldX: gwx, ghostWorldY: gwy, ghostWorldScale: gws, time: t, ghostVelX } = this;
    const [gsx] = this.toScreen(gwx, gwy);

    // Reflection: larger, brighter, more visible
    const refCY = pcy + (pcy - this.toScreen(gwx, gwy)[1]) * 0.2;
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
        const alpha = sdf.rim * 0.5;
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

  getPhase() { return this.progress > 0.95 ? 'landing' : 'animating'; }
  isOverlayReady() { return this.landingFired; }
}
