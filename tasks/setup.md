# CLAUDE CODE BUILD PROMPT: Ghost Matrix Splash Page

## Reference Image

The uploaded reference image (`reference.png` in the project root) is the NORTH STAR for this entire build. Study it carefully. It shows:

- A **ghost character made entirely of glowing matrix-style text** (numbers, letters, symbols flowing in horizontal lines that contour the ghost's form) floating above a dark surface
- The ghost has **two hollow oval eyes** and a classic draped/flowing silhouette with wavy bottom edges
- A **digital puddle/pool** on the ground beneath the ghost, rendered as a flat reflective surface with a **matrix grid of blue-tinted text characters**
- The **ghost's reflection** is visible in the puddle — distorted, rippling, with the text flowing downward in the reflection
- The atmosphere is **midnight black** with subtle blue ambient light on the ground texture
- The ghost emits a **soft white-blue glow/bloom** that illuminates the surrounding darkness
- The puddle surface has an **irregular, organic edge** (not a perfect circle) and contains a grid of colored characters (primarily blue, some green/cyan accents)

---

## Project Overview

Build a **cinematic splash page** with a full-screen WebGL animation that tells a micro-story:

1. **Scene opens**: Dark void. Matrix-style text rain begins falling. The ghost character assembles from the falling characters — text flows into and through a ghost-shaped bounding region, forming the creature.
2. **Ghost floats**: The ghost drifts organically across the screen, text continuously flowing through its body. Subtle bobbing, tilting, and edge wobble.
3. **Puddle appears**: A digital puddle materializes on a ground plane below the ghost. It starts small and grows with a ripple effect. The puddle surface contains a matrix grid of characters and shows the ghost's reflection.
4. **Ghost approaches & peers down**: The ghost floats toward the puddle and tilts downward to look at its own reflection.
5. **Camera transition**: The camera smoothly rotates from a **horizontal/three-quarter view** to **looking straight down from above** (bird's-eye), as if the viewer is being pulled into the puddle. The puddle grows to fill the entire screen.
6. **Final state**: The camera is now looking straight down. The screen is the puddle — a full-screen matrix grid with the ghost's reflection visible. Text continues scrolling/flowing. The **brand logo** fades in at center, and **navigation options** (Contact, Our Projects, About, etc.) appear around it in an avant-garde layout. This is the persistent landing state.

---

## Tech Stack

```
Framework:      Next.js 14+ (App Router)
3D Engine:      Three.js r170+
Text Rendering: Custom InstancedMesh + MSDF font atlas (ShaderMaterial)
Post-Processing: @react-three/postprocessing (pmndrs) — BloomEffect, selective bloom
Animation:      GSAP 3 + ScrollTrigger (timeline orchestration)
Smooth Scroll:  Lenis
React Bridge:   @react-three/fiber + @react-three/drei
GPU Detection:  detect-gpu (tiered quality presets)
Fonts:          Google Fonts — "Space Mono" for matrix chars, "Syne" for UI text
```

### Install Commands
```bash
npx create-next-app@latest ghost-splash --typescript --tailwind --app --src-dir
cd ghost-splash
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
npm install gsap @gsap/react lenis
npm install detect-gpu
npm install msdf-bmfont-xml # for generating font atlas
npm install --save-dev @types/three
```

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout, font loading, metadata
│   ├── page.tsx                      # Main page — mounts the experience
│   └── globals.css                   # CSS variables, base styles
│
├── components/
│   ├── SplashExperience.tsx          # Top-level R3F Canvas + overlay UI
│   ├── Scene.tsx                     # Three.js scene composition
│   │
│   ├── particles/
│   │   ├── TextParticleSystem.tsx    # InstancedMesh with matrix rain
│   │   ├── particle.vert.glsl       # Vertex shader
│   │   ├── particle.frag.glsl       # Fragment shader (MSDF + SDF mask)
│   │   └── FontAtlas.ts             # MSDF atlas loader + UV mapping
│   │
│   ├── ghost/
│   │   ├── GhostCharacter.tsx       # Ghost entity — position, animation, SDF params
│   │   ├── ghost-sdf.glsl           # Ghost SDF functions (head, body, eyes, tail)
│   │   └── GhostGlow.tsx            # Additive glow sprite/shader around ghost
│   │
│   ├── puddle/
│   │   ├── DigitalPuddle.tsx         # Reflective ground plane with matrix grid
│   │   ├── puddle-reflection.vert.glsl
│   │   ├── puddle-reflection.frag.glsl
│   │   └── WaterRipple.ts           # DuDv displacement for water effect
│   │
│   ├── camera/
│   │   ├── CameraRig.tsx            # GSAP-driven camera animation (slerp)
│   │   └── CameraPath.ts            # Keyframe positions + quaternions
│   │
│   ├── environment/
│   │   ├── GroundPlane.tsx           # Dark textured ground with subtle roughness
│   │   ├── AmbientParticles.tsx      # Floating dust/data motes in the air
│   │   └── FogController.tsx         # Depth fog for atmosphere
│   │
│   ├── ui/
│   │   ├── SplashOverlay.tsx         # HTML overlay: logo + navigation (CSS)
│   │   ├── NavigationReveal.tsx      # Staggered reveal animation for nav items
│   │   ├── Logo.tsx                  # Brand logo component (SVG or text)
│   │   └── LoadingScreen.tsx         # Preloader while assets load
│   │
│   └── effects/
│       ├── PostProcessing.tsx        # EffectComposer: Bloom, Vignette, ChromaticAberration
│       └── TransitionComposer.tsx    # Render target crossfade for puddle zoom
│
├── shaders/
│   ├── includes/
│   │   ├── sdf-primitives.glsl      # Circle, ellipse, box, smooth union
│   │   ├── noise.glsl               # Simplex noise, curl noise
│   │   ├── msdf-utils.glsl          # Median-of-three, SDF threshold
│   │   └── color-palette.glsl       # Moonlight color ramp function
│   └── fullscreen-transition.frag.glsl  # Noise-based wipe for scene transitions
│
├── hooks/
│   ├── useAnimationTimeline.ts       # GSAP master timeline hook
│   ├── useDeviceCapability.ts        # detect-gpu wrapper, quality tier
│   ├── useLenis.ts                   # Smooth scroll integration
│   └── usePhaseController.ts         # State machine: intro → float → approach → dive → landing
│
├── lib/
│   ├── constants.ts                  # Color palette, timing, sizes
│   ├── math-utils.ts                 # Lerp, remap, quaternion helpers
│   └── font-atlas-config.ts          # Character set, atlas dimensions, UV map
│
├── assets/
│   ├── fonts/
│   │   ├── space-mono-msdf.png       # Generated MSDF atlas texture
│   │   └── space-mono-msdf.json      # Atlas metadata (glyph UVs, sizes)
│   └── textures/
│       ├── ground-roughness.jpg       # Subtle ground texture
│       └── dudv-map.jpg               # Water distortion map
│
└── types/
    └── index.ts                       # TypeScript interfaces
```

---

## Color Palette (CSS Variables + Shader Uniforms)

```css
:root {
  /* Core palette — midnight moonlight */
  --void-black:      #050510;    /* rgb(5, 5, 16) — deepest background */
  --midnight-navy:   #0A0F2E;    /* rgb(10, 15, 46) — secondary depth */
  --deep-steel:      #1A2744;    /* rgb(26, 39, 68) — mid shadow */
  --dusty-blue:      #3B5998;    /* rgb(59, 89, 152) — particle trail */
  --moonlit-blue:    #7EB8E0;    /* rgb(126, 184, 224) — primary glow */
  --ice-blue:        #C8E0FF;    /* rgb(200, 224, 255) — bright text core */
  --peak-white:      #FFFFFF;    /* rgb(255, 255, 255) — hottest highlight */

  /* Accent — puddle grid */
  --grid-cyan:       #00E5FF;    /* Puddle grid lines */
  --grid-green:      #39FF14;    /* Sparse green accents in matrix */

  /* UI */
  --text-primary:    #C8E0FF;
  --text-secondary:  #7EB8E0;
  --text-ghost:      rgba(126, 184, 224, 0.4);
}
```

### Shader Color Ramp

```glsl
// In color-palette.glsl
vec3 moonlightRamp(float t) {
    // t = 0.0 (shadow) to 1.0 (peak brightness)
    vec3 voidBlack   = vec3(0.020, 0.020, 0.063);
    vec3 midnightNav = vec3(0.039, 0.059, 0.180);
    vec3 deepSteel   = vec3(0.102, 0.153, 0.267);
    vec3 dustyBlue   = vec3(0.231, 0.349, 0.596);
    vec3 moonlitBlue = vec3(0.494, 0.722, 0.878);
    vec3 iceBlue     = vec3(0.784, 0.878, 1.000);
    vec3 peakWhite   = vec3(1.000, 1.000, 1.000);

    if (t < 0.15) return mix(voidBlack, midnightNav, t / 0.15);
    if (t < 0.30) return mix(midnightNav, deepSteel, (t - 0.15) / 0.15);
    if (t < 0.50) return mix(deepSteel, dustyBlue, (t - 0.30) / 0.20);
    if (t < 0.70) return mix(dustyBlue, moonlitBlue, (t - 0.50) / 0.20);
    if (t < 0.90) return mix(moonlitBlue, iceBlue, (t - 0.70) / 0.20);
    return mix(iceBlue, peakWhite, (t - 0.90) / 0.10);
}
```

---

## Phase 1: Text Particle System (Matrix Rain)

### Architecture
- Use `THREE.InstancedMesh` with a small `PlaneGeometry` (quad) as the base
- Each instance = one character, rendered via MSDF font atlas
- Pre-allocate 5,000 instances (configurable by quality tier)
- Characters fall in **columns** — each column has a random speed, character set, and brightness wave

### Per-Instance Attributes (InstancedBufferAttribute)
```typescript
interface ParticleAttributes {
  aCharUV: Float32Array;     // vec4: x, y, width, height in atlas
  aColumnData: Float32Array; // vec3: columnX, fallSpeed, phase offset
  aCharIndex: Float32Array;  // float: index into character set (animated)
  aSize: Float32Array;       // float: character scale (variable sizes!)
  aBrightness: Float32Array; // float: base brightness multiplier
}
```

### Vertex Shader (particle.vert.glsl)
```glsl
attribute vec4 aCharUV;
attribute vec3 aColumnData;
attribute float aCharIndex;
attribute float aSize;
attribute float aBrightness;

uniform float uTime;
uniform float uColumnCount;
uniform vec2 uResolution;

varying vec2 vUV;
varying float vBrightness;
varying vec2 vWorldPos;

void main() {
    float columnX = aColumnData.x;
    float fallSpeed = aColumnData.y;
    float phase = aColumnData.z;

    // Rain position — characters fall continuously, wrapping at bottom
    float y = mod(phase - uTime * fallSpeed, 2.0) - 1.0; // normalized -1 to 1
    float x = columnX;

    vec3 pos = vec3(x, y, 0.0);

    // Scale by character size attribute
    vec3 scaled = position * aSize;
    pos.xy += scaled.xy;

    vUV = aCharUV.xy + position.xy * aCharUV.zw; // Sample from atlas
    vWorldPos = pos.xy;

    // Brightness wave — characters near the "raindrop head" are brightest
    float wavePos = mod(phase - uTime * fallSpeed * 1.2, 2.0) - 1.0;
    float distToHead = abs(y - wavePos);
    vBrightness = aBrightness * smoothstep(0.5, 0.0, distToHead);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
```

### Fragment Shader (particle.frag.glsl)
```glsl
uniform sampler2D uFontAtlas;
uniform float uTime;
uniform vec2 uGhostPosition;
uniform float uGhostMaskEnabled; // 0.0 or 1.0
uniform float uGlobalAlpha;

varying vec2 vUV;
varying float vBrightness;
varying vec2 vWorldPos;

// Include SDF primitives and MSDF utils
#include <msdf-utils.glsl>
#include <ghost-sdf.glsl>
#include <color-palette.glsl>

void main() {
    // MSDF sampling
    vec3 msdfSample = texture2D(uFontAtlas, vUV).rgb;
    float sd = median(msdfSample.r, msdfSample.g, msdfSample.b);
    float alpha = smoothstep(0.45, 0.55, sd); // Crisp edge

    if (alpha < 0.01) discard;

    // Ghost SDF mask — only show characters inside the ghost
    if (uGhostMaskEnabled > 0.5) {
        float ghostMask = ghostSDF(vWorldPos, uGhostPosition, uTime);
        alpha *= ghostMask;
        if (alpha < 0.01) discard;
    }

    // Color from brightness ramp
    vec3 color = moonlightRamp(vBrightness);

    // Add subtle glow halo around character (widen SDF threshold)
    float glow = smoothstep(0.25, 0.55, sd) - smoothstep(0.45, 0.55, sd);
    color += vec3(0.494, 0.722, 0.878) * glow * 0.5;

    gl_FragColor = vec4(color, alpha * uGlobalAlpha);
}
```

### Character Cycling
Every 100ms (configurable), randomly reassign `aCharIndex` for ~10% of particles to simulate character flickering. Use a typed array and `needsUpdate = true` on the attribute. Characters cycle through: `0-9, A-Z, アイウエオカキクケコ, +=<>{}[]|/\`.

### Variable Sizes (Critical!)
The reference image shows text at **multiple scales**. Implement 3 size tiers:
- **Small** (0.6x): 60% of particles — dense background texture
- **Medium** (1.0x): 30% of particles — primary readability
- **Large** (1.8x): 10% of particles — bold accent characters

---

## Phase 2: Ghost Character (SDF Masking)

### Ghost SDF Construction

Study the reference image ghost shape carefully. It has:
- A **rounded head** (slightly wider than tall, not a perfect circle)
- **Two hollow oval eyes** — dark voids inside the ghost
- A **flowing body** that drapes down and to the right (like a sheet ghost)
- A **wavy bottom edge** with 3-4 undulating "tentacles" or drapes
- **Organic, slightly asymmetric** silhouette

```glsl
// ghost-sdf.glsl
float ghostSDF(vec2 p, vec2 center, float time) {
    vec2 q = p - center;

    // Head — slightly squashed circle
    float head = length(q * vec2(1.0, 1.2) - vec2(0.0, 0.15)) - 0.18;

    // Body — tapered ellipse
    float bodyWidth = 0.22 + q.y * 0.15; // wider at top, narrower at bottom
    float body = length(q * vec2(1.0 / bodyWidth, 1.0)) - 1.0;
    body = max(body, -q.y - 0.1); // cut off above head

    // Combine head and body with smooth union
    float shape = smin(head, body, 0.12);

    // Wavy bottom edge
    float wave = sin(q.x * 12.0 + time * 2.5) * 0.03
               + sin(q.x * 7.0 - time * 1.8) * 0.02;
    float bottomCut = q.y + 0.35 + wave;
    shape = max(shape, -bottomCut);

    // Eyes — two subtracted ellipses (DARK VOIDS)
    float eyeL = length((q - vec2(-0.06, 0.18)) * vec2(1.3, 1.0)) - 0.035;
    float eyeR = length((q - vec2(0.06, 0.16)) * vec2(1.3, 1.0)) - 0.035;
    // Don't subtract — we'll use these to DARKEN characters inside eyes
    float eyeMask = min(eyeL, eyeR);

    // Final mask
    float outerMask = 1.0 - smoothstep(-0.01, 0.01, shape);
    float eyeDarken = smoothstep(0.01, -0.01, eyeMask) * 0.85; // 85% darker in eyes

    return outerMask * (1.0 - eyeDarken);
}

// Glow halo around ghost
float ghostGlow(vec2 p, vec2 center, float time) {
    vec2 q = p - center;
    float head = length(q * vec2(1.0, 1.2) - vec2(0.0, 0.15)) - 0.18;
    float body = length(q * vec2(1.0 / 0.22, 1.0)) - 1.0;
    float d = smin(head, body, 0.12);
    return exp(-max(d, 0.0) * 6.0) * 0.4; // Soft exponential falloff
}
```

### Ghost Animation
```typescript
// GhostCharacter.tsx — uniform updates per frame
const ghostAnim = {
  // Gentle floating bob
  y: Math.sin(time * 0.8) * 0.05 + baseY,
  // Slight horizontal drift
  x: Math.sin(time * 0.3) * 0.1 + baseX,
  // Subtle tilt (rotate Z)
  tilt: Math.sin(time * 0.5) * 0.05,
  // Edge wobble via noise
  wobble: simplex2D(time * 0.4, 0.0) * 0.02,
};
```

---

## Phase 3: Digital Puddle

### Puddle Construction
- `THREE.PlaneGeometry` rotated to lie flat on the ground (rotateX -PI/2)
- **Irregular edge shape**: Use a `THREE.ShapeGeometry` with a hand-drawn or noise-generated organic outline (NOT a circle — reference image shows an irregular, almost splatter-like edge)
- The puddle surface texture is a **SEPARATE matrix grid** rendered to a `WebGLRenderTarget`

### Puddle Surface (Matrix Grid)
Render a second, independent matrix rain to an offscreen render target. This one is:
- **Top-down perspective** (as if looking straight down at a grid)
- Characters laid out in a **grid pattern** (not columns) with slight random offsets
- Color palette shifted more toward **blue-cyan** with occasional green accents
- Lower opacity / more muted than the ghost's characters

### Reflection
- Use Three.js `Reflector` (from drei: `<MeshReflectorMaterial>`) or custom render-target reflection
- The ghost is rendered twice — once normally, once mirrored across the puddle plane
- The reflected ghost has:
  - Flipped Y
  - DuDv water distortion applied (ripples emanating from puddle center)
  - Reduced opacity (0.6)
  - Slight vertical stretch/smear (the reflection in the reference looks elongated)

### Water Ripple Effect
```glsl
// In puddle-reflection.frag.glsl
uniform sampler2D uDuDvMap;
uniform sampler2D uReflectionTexture;
uniform sampler2D uPuddleGridTexture;
uniform float uTime;

varying vec2 vUV;

void main() {
    // DuDv distortion
    vec2 distortion = texture2D(uDuDvMap, vUV * 3.0 + uTime * 0.02).rg * 2.0 - 1.0;
    distortion *= 0.015; // Subtle ripple

    // Sample reflection with distortion
    vec4 reflection = texture2D(uReflectionTexture, vUV + distortion);

    // Sample puddle grid
    vec4 grid = texture2D(uPuddleGridTexture, vUV);

    // Composite: grid base + reflection overlay
    vec3 color = grid.rgb * 0.6 + reflection.rgb * 0.5;

    // Fresnel-like edge darkening
    float edgeDist = length(vUV - 0.5) * 2.0;
    color *= 1.0 - smoothstep(0.7, 1.0, edgeDist) * 0.5;

    gl_FragColor = vec4(color, 1.0);
}
```

---

## Phase 4: Camera Transition

### Camera Path
The camera moves through 5 keyframed positions, interpolated via quaternion slerp:

```typescript
const cameraKeyframes = [
  {
    label: 'establishing',
    position: new THREE.Vector3(0, 2, 6),    // Wide establishing shot
    lookAt: new THREE.Vector3(0, 0.5, 0),
    time: 0,
  },
  {
    label: 'three-quarter',
    position: new THREE.Vector3(3, 1.5, 4),  // Three-quarter angle
    lookAt: new THREE.Vector3(0, 0.3, 0),
    time: 2,
  },
  {
    label: 'approaching',
    position: new THREE.Vector3(1, 2.5, 2),  // Moving above
    lookAt: new THREE.Vector3(0, -0.5, 0),   // Looking down at puddle
    time: 4,
  },
  {
    label: 'overhead',
    position: new THREE.Vector3(0, 5, 0.01), // Nearly top-down
    lookAt: new THREE.Vector3(0, -1, 0),
    time: 6,
  },
  {
    label: 'final',
    position: new THREE.Vector3(0, 8, 0.001), // Full bird's-eye
    lookAt: new THREE.Vector3(0, -1, 0),       // Straight down
    time: 7.5,
  },
];
```

### GSAP Master Timeline
```typescript
const masterTimeline = gsap.timeline({ paused: true });

masterTimeline
  // Phase 1: Ghost assembly (0s - 2s)
  .fromTo(uniforms.uGlobalAlpha, { value: 0 }, { value: 1, duration: 1.5 }, 0)
  .fromTo(uniforms.uGhostMaskEnabled, { value: 0 }, { value: 1, duration: 0.5 }, 1.0)
  .add('ghostReady', 2)

  // Phase 2: Ghost floating (2s - 4s)
  .to(ghostPosition, { x: 0.5, y: 0.3, duration: 2, ease: 'sine.inOut' }, 'ghostReady')
  .add('puddleAppear', 3)

  // Phase 3: Puddle materializes (3s - 5s)
  .fromTo(puddleScale, { value: 0 }, { value: 1, duration: 1.5, ease: 'expo.out' }, 'puddleAppear')
  .fromTo(puddleOpacity, { value: 0 }, { value: 1, duration: 1 }, 'puddleAppear+=0.3')
  .add('approach', 4.5)

  // Phase 4: Ghost approaches puddle (4.5s - 6s)
  .to(ghostPosition, { y: 0.1, duration: 1.5, ease: 'power2.inOut' }, 'approach')
  .to(ghostTilt, { value: -0.3, duration: 1.5, ease: 'power2.inOut' }, 'approach') // tilt to look down
  .add('dive', 6)

  // Phase 5: Camera dives to top-down (6s - 8s)
  // Camera keyframes driven by the cameraKeyframes array with slerp
  .to(cameraProgress, { value: 1, duration: 2.5, ease: 'power3.inOut' }, 'dive')
  .to(puddleScale, { value: 5, duration: 2.5, ease: 'power2.in' }, 'dive') // puddle fills screen
  .add('landing', 8)

  // Phase 6: UI reveal (8s - 10s)
  .to(sceneOpacity, { value: 0.6, duration: 1, ease: 'power2.out' }, 'landing') // dim 3D scene slightly
  .fromTo('.logo', { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'expo.out' }, 'landing+=0.3')
  .fromTo('.nav-item', {
    opacity: 0, y: 30, filter: 'blur(10px)'
  }, {
    opacity: 1, y: 0, filter: 'blur(0px)',
    duration: 0.8, stagger: 0.15, ease: 'power3.out'
  }, 'landing+=0.8');
```

---

## Phase 5: Post-Processing

### Effect Stack (in order)
```tsx
<EffectComposer>
  <Bloom
    intensity={1.5}
    luminanceThreshold={0.6}
    luminanceSmoothing={0.3}
    radius={0.4}
  />
  <Vignette
    offset={0.3}
    darkness={0.7}
  />
  <ChromaticAberration
    offset={[0.0005, 0.0005]}  // Very subtle
  />
</EffectComposer>
```

### Selective Bloom
- Assign the ghost's text particles and glow to Three.js layer 1
- Configure bloom to only affect layer 1 objects
- Ground plane and puddle edges stay unbloommed for contrast

### Tone Mapping
```typescript
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8; // Slightly underexposed for moody feel
```

---

## Phase 6: UI Overlay (The Avant-Garde Landing State)

### Design Direction
This is NOT a standard centered-text-with-button layout. Think **editorial/experimental typography agency**. Reference: Sagmeister & Walsh, Pentagram, Wieden+Kennedy websites.

### Layout Concept
Once the camera is top-down and the puddle fills the screen:

```
┌─────────────────────────────────────────────────┐
│                                                   │
│                                                   │
│         ╔═══════════════════════╗                  │
│         ║                       ║                  │
│         ║    [ BRAND LOGO ]     ║                  │
│         ║    glowing, breathing ║                  │
│         ║                       ║                  │
│         ╚═══════════════════════╝                  │
│                                                   │
│                                                   │
│   ┌──────┐                          ┌──────────┐  │
│   │ OUR  │                          │ CONTACT  │  │
│   │WORKS │                          │          │  │
│   └──────┘                          └──────────┘  │
│                                                   │
│              ┌───────────┐                        │
│              │   ABOUT   │                        │
│              └───────────┘                        │
│                                                   │
│                        ┌─────────┐                │
│                        │ JOURNAL │                │
│                        └─────────┘                │
│                                                   │
└─────────────────────────────────────────────────┘
  Background: fullscreen puddle with matrix grid
  still animating. Ghost reflection visible.
```

### Navigation Item Style
- Each nav item is a **floating card/pill** with a translucent dark background (`rgba(5, 5, 16, 0.6)`) and a subtle `backdrop-filter: blur(12px)` + thin glowing border (`1px solid rgba(126, 184, 224, 0.2)`)
- On hover: border brightens, text glows, subtle scale-up (1.05), card shifts slightly toward cursor (magnetic effect)
- Text in **uppercase, letter-spacing: 0.2em**, font: "Syne" bold
- Cards are positioned **asymmetrically** — NOT in a grid. Slightly scattered, different sizes, creating visual tension
- Each card has a subtle parallax drift tied to mouse position

### Logo
- The brand logo renders as **text made of the same matrix characters** — like a micro version of the ghost's texture. Use a canvas element to render the logo text with the MSDF atlas, creating a "logo-shaped bounding box filled with scrolling matrix text"
- Alternatively, if a simpler approach: clean "Syne" font in ice-blue with a CSS text-shadow glow
- The logo should have a subtle **breathing animation** — opacity pulsing between 0.85 and 1.0 with a 4-second cycle

### CSS for Overlay
```css
.splash-overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none; /* Pass through to WebGL until landing */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'Syne', sans-serif;
}

.splash-overlay.--active {
  pointer-events: auto;
}

.logo {
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--ice-blue);
  text-shadow:
    0 0 20px rgba(126, 184, 224, 0.6),
    0 0 60px rgba(126, 184, 224, 0.3),
    0 0 100px rgba(126, 184, 224, 0.1);
  animation: breathe 4s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}

.nav-item {
  position: absolute;
  padding: 1rem 2rem;
  background: rgba(5, 5, 16, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(126, 184, 224, 0.15);
  border-radius: 4px;
  color: var(--ice-blue);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-item:hover {
  border-color: rgba(126, 184, 224, 0.6);
  text-shadow: 0 0 15px rgba(126, 184, 224, 0.5);
  transform: scale(1.05);
  background: rgba(10, 15, 46, 0.7);
}
```

---

## Phase 7: Performance & Mobile

### Quality Tiers
```typescript
import { getGPUTier } from 'detect-gpu';

const tier = await getGPUTier();

const qualitySettings = {
  high: {   // tier.tier >= 2
    particleCount: 5000,
    bloomEnabled: true,
    reflectionEnabled: true,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
    puddleResolution: 1024,
  },
  medium: { // tier.tier >= 1
    particleCount: 2000,
    bloomEnabled: true,
    reflectionEnabled: false, // skip reflection render target
    pixelRatio: 1,
    puddleResolution: 512,
  },
  low: {    // tier.tier < 1 or no WebGL
    particleCount: 500,
    bloomEnabled: false,
    reflectionEnabled: false,
    pixelRatio: 1,
    puddleResolution: 256,
  },
};
```

### CSS Fallback (No WebGL)
If WebGL is unavailable, show a **CSS-only version**:
- Static dark background with radial gradient (void → midnight navy)
- Ghost SVG silhouette with `text-shadow` glow and CSS animation (float + tilt)
- CSS `@keyframes` rain effect using pseudo-elements or a lightweight canvas 2D fallback
- Same UI overlay appears after a timed delay

### Loading Screen
- Minimal: void black background with the brand name in ice-blue, pulsing
- Show a thin progress bar at the bottom with moonlit-blue fill
- Preload: MSDF atlas, DuDv texture, ground texture
- After load complete, GSAP timeline begins playing

---

## Critical Implementation Notes

1. **DO NOT use troika-three-text for the particle characters.** It creates individual Text meshes which can't be instanced efficiently. Use the custom InstancedMesh + MSDF atlas approach.

2. **The ghost is NOT a 3D model.** It's a 2D SDF mask evaluated per-pixel in the fragment shader. The characters flow through the ghost shape on a flat plane.

3. **Characters appear to flow in contour lines around the ghost** in the reference image — this is achieved by the SDF mask: characters near the ghost edge are visible, characters far from the edge fade out. Add a second mask layer that creates horizontal banding (the "contour line" effect):
   ```glsl
   float contourLines = sin(vWorldPos.y * 40.0 + uTime * 3.0) * 0.5 + 0.5;
   float edgeDist = abs(ghostSDF_raw(vWorldPos, uGhostPos, uTime));
   float contourMask = smoothstep(0.02, 0.0, edgeDist) * contourLines;
   ```

4. **The puddle's matrix grid is a SEPARATE render** from the rain. It's a top-down grid of characters (rows + columns, not just columns) rendered to a WebGLRenderTarget and used as a texture on the puddle plane.

5. **The animation should be TIME-based, not scroll-based.** It plays automatically on page load. After the landing state is reached, the user can scroll to explore additional content if needed.

6. **Preserve the text-keeps-scrolling effect on the final frame.** When the UI appears, the WebGL scene continues animating underneath — the matrix grid in the puddle keeps flowing, characters keep cycling. Only the camera position is frozen.

7. **The ground around the puddle** should have a subtle texture — not flat black. Add a very dark, slightly rough surface (like wet asphalt or dark earth) visible in the establishing shot. Use a simple `MeshStandardMaterial` with `roughness: 0.9`, `metalness: 0.0`, and a dark `color: #0A0A14`.

8. **Sound design** (optional but impactful): Consider adding a subtle ambient audio track — low droning hum, occasional digital glitch sounds, water drip when the puddle appears. Use the Web Audio API with user gesture to start (click/tap to begin experience).

---

## Quick Start: Build Order

1. **Set up Next.js + R3F scene** — blank canvas with void-black background, basic PerspectiveCamera
2. **Implement MSDF font atlas loader** — load texture + JSON metadata, create UV lookup
3. **Build TextParticleSystem** — InstancedMesh with matrix rain, single column first, then full grid
4. **Add Ghost SDF mask** — fragment shader masking, verify ghost shape matches reference
5. **Ghost animation** — floating, bobbing, drifting
6. **Post-processing** — Bloom + Vignette + tone mapping
7. **Puddle** — ground plane with separate grid texture, basic reflection
8. **Camera animation** — GSAP timeline with keyframes, quaternion slerp
9. **UI overlay** — logo + nav reveal with stagger animation
10. **Polish** — quality tiers, loading screen, mobile fallback, performance tuning

---

## Acceptance Criteria

The splash page is DONE when:

- [ ] Matrix rain characters flow visibly through a ghost-shaped bounding region that matches the reference image's silhouette
- [ ] Ghost floats with organic motion (bob, drift, tilt, edge wobble)
- [ ] Ghost eyes are dark voids within the text body
- [ ] Characters are rendered at multiple sizes (small, medium, large)
- [ ] Digital puddle appears below ghost with matrix grid texture and irregular edges
- [ ] Ghost reflection is visible in the puddle with water ripple distortion
- [ ] Camera smoothly transitions from three-quarter view to bird's-eye
- [ ] Puddle fills the screen as camera reaches top-down position
- [ ] Logo appears with glowing breathing animation after camera settles
- [ ] Navigation items reveal with staggered, blur-to-sharp animation
- [ ] Nav items are positioned asymmetrically with hover glow effects
- [ ] Bloom/glow effect creates the moonlight atmosphere from the reference
- [ ] Color palette matches: void black, midnight navy, moonlit blue, ice blue white
- [ ] Text continues flowing/animating after the UI appears (scene stays alive)
- [ ] Performance: 60fps on mid-range desktop, graceful degradation on mobile
- [ ] Loading screen shows while assets preload
- [ ] No console errors, no memory leaks, clean TypeScript
