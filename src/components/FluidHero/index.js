/**
 * FluidHero
 *
 * Real-time 2D fluid simulation with HDR bloom and sunrays post-processing,
 * rendered behind hero content. The visual pipeline mirrors x.ai's hero:
 * stable-fluids simulation → bloom extract/iterate/composite → sunrays mask
 * and radial blur → shaded final display.
 *
 * Technique:
 *   - Stable fluids (Jos Stam) / PavelDoGreat GPGPU pipeline on WebGL 1:
 *     advect → curl → vorticity → divergence → pressure Jacobi → gradient
 *     subtract → display.
 *   - HDR bloom: prefilter bright pixels → iterative mipmap blur chain →
 *     composite into display with intensity multiplier.
 *   - Sunrays: luminance mask → radial blur from screen center → multiply
 *     and add to display, producing god-ray streaks behind bright dye.
 *   - Shading pass inside the display shader derives a pseudo-normal from
 *     local dye gradients to give the fluid volumetric depth.
 *
 * Motion:
 *   - x.ai-style auto-splats at random screen locations, random cool-tone
 *     colors, random directions. Cadence is slow enough to feel ambient.
 *   - Pointer input adds splats at the cursor with velocity derived from
 *     motion delta.
 *
 * Palette:
 *   - Color hue is restricted to cool tones (cyan → blue → indigo) so the
 *     x.ai pipeline quality renders on-theme for a swiftwater project.
 *
 * SSR / a11y:
 *   - All WebGL work runs inside useEffect, so Docusaurus SSR never touches
 *     window, document, or WebGL.
 *   - Honors prefers-reduced-motion: the sim never mounts; the wrapper's
 *     CSS gradient takes over.
 *   - Falls back to the CSS gradient if WebGL is unavailable or half-float
 *     textures are not supported.
 */

import React, { useEffect, useRef } from 'react';
import styles from './styles.module.css';

/* ------------------------------------------------------------------ */
/* Tunable simulation parameters                                       */
/* ------------------------------------------------------------------ */
const CONFIG = {
  SIM_RESOLUTION: 128,           // fluid solve resolution
  DYE_RESOLUTION: 1024,          // dye grid — high for crisp, bloomable edges
  DENSITY_DISSIPATION: 1.0,      // dye persists; bloom relies on it
  VELOCITY_DISSIPATION: 0.2,     // slow velocity decay for organic drift
  PRESSURE: 0.8,                 // pressure retention between frames
  PRESSURE_ITERATIONS: 20,       // Jacobi iterations
  CURL: 30,                      // vorticity confinement strength
  SPLAT_RADIUS: 0.25,            // size of each splat (% of canvas)
  SPLAT_FORCE: 6000,             // magnitude of each splat's velocity push
  AUTO_SPLAT_INTERVAL_MS: 900,   // cadence of idle auto-splats (ambient motion)
  SHADING: true,                 // normal-based shading in display shader
  BLOOM: true,                   // HDR bloom post-processing
  BLOOM_ITERATIONS: 8,           // downsample steps in bloom blur chain
  BLOOM_RESOLUTION: 256,         // bloom working resolution
  BLOOM_INTENSITY: 0.8,          // glow multiplier
  BLOOM_THRESHOLD: 0.6,          // dye brightness that starts glowing
  BLOOM_SOFT_KNEE: 0.7,          // smoothness of the threshold knee
  SUNRAYS: true,                 // god-ray post-processing
  SUNRAYS_RESOLUTION: 196,       // sunrays working resolution
  SUNRAYS_WEIGHT: 1.0,           // ray intensity
  DPR_CAP: 1.75,                 // cap devicePixelRatio for perf
  BACK_COLOR: { r: 0.0, g: 0.0, b: 0.0 }, // cleared background (dark like x.ai)
};

/* ------------------------------------------------------------------ */
/* GLSL shader sources                                                 */
/* ------------------------------------------------------------------ */

/* Five-tap neighborhood vertex shader — used by most simulation passes. */
const BASE_VERT = /* glsl */ `
  precision highp float;
  attribute vec2 aPosition;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;
  void main () {
    vUv = aPosition * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

/* Three-tap blur vertex shader — used by the post-process blur pass. */
const BLUR_VERT = /* glsl */ `
  precision highp float;
  attribute vec2 aPosition;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  uniform vec2 texelSize;
  void main () {
    vUv = aPosition * 0.5 + 0.5;
    float offset = 1.33333333;
    vL = vUv - texelSize * offset;
    vR = vUv + texelSize * offset;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */ `
  precision mediump float;
  precision mediump sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  uniform sampler2D uTexture;
  void main () {
    vec4 sum = texture2D(uTexture, vUv) * 0.29411764;
    sum += texture2D(uTexture, vL) * 0.35294117;
    sum += texture2D(uTexture, vR) * 0.35294117;
    gl_FragColor = sum;
  }
`;

const COPY_FRAG = /* glsl */ `
  precision mediump float;
  precision mediump sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  void main () {
    gl_FragColor = texture2D(uTexture, vUv);
  }
`;

const CLEAR_FRAG = /* glsl */ `
  precision mediump float;
  precision mediump sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float value;
  void main () {
    gl_FragColor = value * texture2D(uTexture, vUv);
  }
`;

const COLOR_FRAG = /* glsl */ `
  precision mediump float;
  uniform vec4 color;
  void main () {
    gl_FragColor = color;
  }
`;

const SPLAT_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  void main () {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

const ADVECTION_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform vec2 dyeTexelSize;
  uniform float dt;
  uniform float dissipation;

  vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
    vec2 st = uv / tsize - 0.5;
    vec2 iuv = floor(st);
    vec2 fuv = fract(st);
    vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
    vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
    vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
    vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
    return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
  }

  void main () {
    vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
    gl_FragColor = dissipation * bilerp(uSource, coord, dyeTexelSize);
    gl_FragColor.a = 1.0;
  }
`;

const DIVERGENCE_FRAG = /* glsl */ `
  precision mediump float;
  precision mediump sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    if (vL.x < 0.0) { L = -C.x; }
    if (vR.x > 1.0) { R = -C.x; }
    if (vT.y > 1.0) { T = -C.y; }
    if (vB.y < 0.0) { B = -C.y; }
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

const CURL_FRAG = /* glsl */ `
  precision mediump float;
  precision mediump sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`;

const VORTICITY_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;
  void main () {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * dt;
    velocity = clamp(velocity, -1000.0, 1000.0);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const PRESSURE_FRAG = /* glsl */ `
  precision mediump float;
  precision mediump sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

const GRADIENT_SUBTRACT_FRAG = /* glsl */ `
  precision mediump float;
  precision mediump sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

/* ---- bloom pipeline ---- */

const BLOOM_PREFILTER_FRAG = /* glsl */ `
  precision mediump float;
  precision mediump sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec3 curve;
  uniform float threshold;
  void main () {
    vec3 c = texture2D(uTexture, vUv).rgb;
    float br = max(c.r, max(c.g, c.b));
    float rq = clamp(br - curve.x, 0.0, curve.y);
    rq = curve.z * rq * rq;
    c *= max(rq, br - threshold) / max(br, 0.0001);
    gl_FragColor = vec4(c, 0.0);
  }
`;

const BLOOM_BLUR_FRAG = /* glsl */ `
  precision mediump float;
  precision mediump sampler2D;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  void main () {
    vec4 sum = vec4(0.0);
    sum += texture2D(uTexture, vL);
    sum += texture2D(uTexture, vR);
    sum += texture2D(uTexture, vT);
    sum += texture2D(uTexture, vB);
    sum *= 0.25;
    gl_FragColor = sum;
  }
`;

const BLOOM_FINAL_FRAG = /* glsl */ `
  precision mediump float;
  precision mediump sampler2D;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  uniform float intensity;
  void main () {
    vec4 sum = vec4(0.0);
    sum += texture2D(uTexture, vL);
    sum += texture2D(uTexture, vR);
    sum += texture2D(uTexture, vT);
    sum += texture2D(uTexture, vB);
    sum *= 0.25;
    gl_FragColor = sum * intensity;
  }
`;

/* ---- sunrays pipeline ---- */

const SUNRAYS_MASK_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  void main () {
    vec4 c = texture2D(uTexture, vUv);
    float br = max(c.r, max(c.g, c.b));
    c.a = 1.0 - min(max(br * 20.0, 0.0), 0.8);
    gl_FragColor = c;
  }
`;

const SUNRAYS_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float weight;
  #define ITERATIONS 16
  void main () {
    float Density = 0.3;
    float Decay = 0.95;
    float Exposure = 0.7;
    vec2 coord = vUv;
    vec2 dir = vUv - 0.5;
    dir *= 1.0 / float(ITERATIONS) * Density;
    float illuminationDecay = 1.0;
    float color = texture2D(uTexture, vUv).a;
    for (int i = 0; i < ITERATIONS; i++) {
      coord -= dir;
      float col = texture2D(uTexture, coord).a;
      color += col * illuminationDecay * weight;
      illuminationDecay *= Decay;
    }
    gl_FragColor = vec4(color * Exposure, 0.0, 0.0, 1.0);
  }
`;

/* ---- display with bloom + sunrays + shading ---- */

const DISPLAY_FRAG = /* glsl */ `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uTexture;
  uniform sampler2D uBloom;
  uniform sampler2D uSunrays;
  uniform vec2 texelSize;

  void main () {
    vec3 c = texture2D(uTexture, vUv).rgb;

    // Shading: use local luminance gradient as a pseudo-normal, lit from +Z.
    // Gives the dye a volumetric, almost-liquid feel, matching x.ai's sheen.
    float dl = length(texture2D(uTexture, vL).rgb);
    float dr = length(texture2D(uTexture, vR).rgb);
    float dtop = length(texture2D(uTexture, vT).rgb);
    float db = length(texture2D(uTexture, vB).rgb);
    vec3 n = normalize(vec3(dr - dl, db - dtop, length(texelSize)));
    vec3 l = vec3(0.0, 0.0, 1.0);
    float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);
    c *= diffuse;

    // Bloom: additive glow from bright dye regions.
    vec3 bloom = texture2D(uBloom, vUv).rgb;
    c += bloom;

    // Sunrays: multiplied as a luminance mask, then lightly added for tint.
    float sun = texture2D(uSunrays, vUv).r;
    c *= sun;
    c += sun * 0.35;

    // Final alpha: maximum channel, gives bright pixels more presence over bg.
    float a = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c, a);
  }
`;

/* ------------------------------------------------------------------ */
/* WebGL helpers                                                       */
/* ------------------------------------------------------------------ */

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn('FluidHero shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertSrc, fragSrc) {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn('FluidHero program link failed:', gl.getProgramInfoLog(program));
    return null;
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const info = gl.getActiveUniform(program, i);
    uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

function createFBO(gl, w, h, internalFormat, format, type, param) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return {
    texture,
    fbo,
    width: w,
    height: h,
    texelSizeX: 1 / w,
    texelSizeY: 1 / h,
    attach(id) {
      gl.activeTexture(gl.TEXTURE0 + id);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return id;
    },
  };
}

function createDoubleFBO(gl, w, h, internalFormat, format, type, param) {
  let fbo1 = createFBO(gl, w, h, internalFormat, format, type, param);
  let fbo2 = createFBO(gl, w, h, internalFormat, format, type, param);
  return {
    width: w,
    height: h,
    texelSizeX: 1 / w,
    texelSizeY: 1 / h,
    get read() { return fbo1; },
    set read(v) { fbo1 = v; },
    get write() { return fbo2; },
    set write(v) { fbo2 = v; },
    swap() {
      const tmp = fbo1;
      fbo1 = fbo2;
      fbo2 = tmp;
    },
  };
}

function getSupportedFormat(gl, internalFormat, format, type) {
  if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
    return null;
  }
  return { internalFormat, format };
}

function supportRenderTextureFormat(gl, internalFormat, format, type) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.deleteTexture(texture);
  gl.deleteFramebuffer(fbo);
  return ok;
}

/* ------------------------------------------------------------------ */
/* Color helpers — HSV → RGB, restricted to cool (water) tones.        */
/* ------------------------------------------------------------------ */
function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

/*
 * x.ai uses a full-spectrum HSV rotation. This project's theme is
 * swiftwater, so the hue is biased toward cool tones: cyan → blue → violet,
 * with occasional aqua and indigo accents. The 0.15 intensity multiplier
 * keeps each splat sub-unit, so bloom has headroom to push highlights
 * over 1.0 and glow.
 */
function generateColor() {
  const h = 0.48 + Math.random() * 0.20; // 0.48..0.68 ≈ aqua → indigo
  const s = 0.85 + Math.random() * 0.15;
  const v = 1.0;
  const [r, g, b] = hsvToRgb(h, s, v);
  return { r: r * 0.15, g: g * 0.15, b: b * 0.15 };
}

/* ------------------------------------------------------------------ */
/* React component                                                     */
/* ------------------------------------------------------------------ */
export default function FluidHero({ children, className }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return undefined;

    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return undefined;

    const glOpts = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    };
    const gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
    if (!gl) return undefined;

    const halfFloat = gl.getExtension('OES_texture_half_float');
    const supportLinear = gl.getExtension('OES_texture_half_float_linear');
    const halfFloatTexType = halfFloat ? halfFloat.HALF_FLOAT_OES : null;
    if (!halfFloatTexType) return undefined;

    const rgba = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    if (!rgba) return undefined;

    const filtering = supportLinear ? gl.LINEAR : gl.NEAREST;

    /* -- programs -- */
    const copyProgram = createProgram(gl, BASE_VERT, COPY_FRAG);
    const clearProgram = createProgram(gl, BASE_VERT, CLEAR_FRAG);
    const colorProgram = createProgram(gl, BASE_VERT, COLOR_FRAG);
    const splatProgram = createProgram(gl, BASE_VERT, SPLAT_FRAG);
    const advectionProgram = createProgram(gl, BASE_VERT, ADVECTION_FRAG);
    const divergenceProgram = createProgram(gl, BASE_VERT, DIVERGENCE_FRAG);
    const curlProgram = createProgram(gl, BASE_VERT, CURL_FRAG);
    const vorticityProgram = createProgram(gl, BASE_VERT, VORTICITY_FRAG);
    const pressureProgram = createProgram(gl, BASE_VERT, PRESSURE_FRAG);
    const gradientSubtractProgram = createProgram(gl, BASE_VERT, GRADIENT_SUBTRACT_FRAG);

    const bloomPrefilterProgram = createProgram(gl, BASE_VERT, BLOOM_PREFILTER_FRAG);
    const bloomBlurProgram = createProgram(gl, BASE_VERT, BLOOM_BLUR_FRAG);
    const bloomFinalProgram = createProgram(gl, BASE_VERT, BLOOM_FINAL_FRAG);

    const sunraysMaskProgram = createProgram(gl, BASE_VERT, SUNRAYS_MASK_FRAG);
    const sunraysProgram = createProgram(gl, BASE_VERT, SUNRAYS_FRAG);

    const blurProgram = createProgram(gl, BLUR_VERT, BLUR_FRAG);

    const displayProgram = createProgram(gl, BASE_VERT, DISPLAY_FRAG);

    if (
      !copyProgram || !clearProgram || !colorProgram || !splatProgram ||
      !advectionProgram || !divergenceProgram || !curlProgram ||
      !vorticityProgram || !pressureProgram || !gradientSubtractProgram ||
      !bloomPrefilterProgram || !bloomBlurProgram || !bloomFinalProgram ||
      !sunraysMaskProgram || !sunraysProgram || !blurProgram || !displayProgram
    ) {
      return undefined;
    }

    /* -- full-screen quad -- */
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 1, 2, 3]), gl.STATIC_DRAW);

    function bindQuad(program) {
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      const loc = gl.getAttribLocation(program, 'aPosition');
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(loc);
    }

    function blit(target) {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    /* -- framebuffers -- */
    let dye;
    let velocity;
    let divergence;
    let curl;
    let pressure;
    let bloom;
    let bloomFramebuffers = [];
    let sunrays;
    let sunraysTemp;

    function initBloomFramebuffers() {
      const res = getResolution(CONFIG.BLOOM_RESOLUTION);
      bloom = createFBO(gl, res.width, res.height, rgba.internalFormat, rgba.format, halfFloatTexType, filtering);
      bloomFramebuffers = [];
      for (let i = 0; i < CONFIG.BLOOM_ITERATIONS; i += 1) {
        const w = res.width >> (i + 1);
        const h = res.height >> (i + 1);
        if (w < 2 || h < 2) break;
        bloomFramebuffers.push(
          createFBO(gl, w, h, rgba.internalFormat, rgba.format, halfFloatTexType, filtering),
        );
      }
    }

    function initSunraysFramebuffers() {
      const res = getResolution(CONFIG.SUNRAYS_RESOLUTION);
      sunrays = createFBO(gl, res.width, res.height, rgba.internalFormat, rgba.format, halfFloatTexType, filtering);
      sunraysTemp = createFBO(gl, res.width, res.height, rgba.internalFormat, rgba.format, halfFloatTexType, filtering);
    }

    function getResolution(resolution) {
      const aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      const w = aspectRatio < 1 ? resolution : Math.round(resolution * aspectRatio);
      const h = aspectRatio < 1 ? Math.round(resolution / aspectRatio) : resolution;
      return { width: w, height: h };
    }

    function initFramebuffers() {
      const simRes = getResolution(CONFIG.SIM_RESOLUTION);
      const dyeRes = getResolution(CONFIG.DYE_RESOLUTION);
      dye = createDoubleFBO(gl, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, halfFloatTexType, filtering);
      velocity = createDoubleFBO(gl, simRes.width, simRes.height, rgba.internalFormat, rgba.format, halfFloatTexType, filtering);
      divergence = createFBO(gl, simRes.width, simRes.height, rgba.internalFormat, rgba.format, halfFloatTexType, gl.NEAREST);
      curl = createFBO(gl, simRes.width, simRes.height, rgba.internalFormat, rgba.format, halfFloatTexType, gl.NEAREST);
      pressure = createDoubleFBO(gl, simRes.width, simRes.height, rgba.internalFormat, rgba.format, halfFloatTexType, gl.NEAREST);
      initBloomFramebuffers();
      initSunraysFramebuffers();
    }

    initFramebuffers();

    /* -- canvas sizing -- */
    let pendingResize = false;
    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.DPR_CAP);
      const w = Math.max(1, Math.floor(wrapper.clientWidth * dpr));
      const h = Math.max(1, Math.floor(wrapper.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        pendingResize = true;
      }
    }
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(wrapper);

    /* -- splat -- */
    function splat(x, y, dx, dy, color) {
      gl.useProgram(splatProgram.program);
      bindQuad(splatProgram.program);
      gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(splatProgram.uniforms.point, x, y);
      gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
      gl.uniform1f(splatProgram.uniforms.radius, correctRadius(CONFIG.SPLAT_RADIUS / 100.0));
      blit(velocity.write);
      velocity.swap();

      gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
      blit(dye.write);
      dye.swap();
    }

    function correctRadius(radius) {
      const ar = canvas.width / canvas.height;
      if (ar > 1) return radius * ar;
      return radius;
    }

    /* -- pointer -- */
    const pointer = {
      x: 0.5, y: 0.5,
      prevX: 0.5, prevY: 0.5,
      dx: 0, dy: 0,
      moved: false,
      color: generateColor(),
    };

    function updatePointer(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      pointer.prevX = pointer.x;
      pointer.prevY = pointer.y;
      pointer.x = x;
      pointer.y = y;
      pointer.dx = (x - pointer.prevX) * 6.0;
      pointer.dy = (y - pointer.prevY) * 6.0;
      pointer.moved = Math.abs(pointer.dx) + Math.abs(pointer.dy) > 0.0;
    }

    const onPointerMove = (e) => updatePointer(e);
    const onPointerDown = (e) => {
      updatePointer(e);
      pointer.color = generateColor();
      pointer.moved = true;
    };
    const onPointerLeave = () => { pointer.moved = false; };

    wrapper.addEventListener('pointermove', onPointerMove);
    wrapper.addEventListener('pointerdown', onPointerDown);
    wrapper.addEventListener('pointerleave', onPointerLeave);

    /* -- auto-splats (x.ai ambient motion) -- */
    let lastAutoSplatAt = 0;
    // Inject a couple of splats on mount so the canvas is never empty.
    function primeCanvas() {
      for (let i = 0; i < 5; i += 1) {
        const color = generateColor();
        color.r *= 10;
        color.g *= 10;
        color.b *= 10;
        const x = Math.random();
        const y = Math.random();
        const dx = 1000 * (Math.random() - 0.5);
        const dy = 1000 * (Math.random() - 0.5);
        splat(x, y, dx, dy, color);
      }
    }
    primeCanvas();

    function maybeAutoSplat(now) {
      if (now - lastAutoSplatAt < CONFIG.AUTO_SPLAT_INTERVAL_MS) return;
      lastAutoSplatAt = now;
      const color = generateColor();
      color.r *= 10;
      color.g *= 10;
      color.b *= 10;
      const x = Math.random();
      const y = Math.random();
      const dx = 1000 * (Math.random() - 0.5);
      const dy = 1000 * (Math.random() - 0.5);
      splat(x, y, dx, dy, color);
    }

    /* -- simulation step -- */
    function step(dt) {
      gl.disable(gl.BLEND);

      // Curl.
      gl.useProgram(curlProgram.program);
      bindQuad(curlProgram.program);
      gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(curl);

      // Vorticity confinement.
      gl.useProgram(vorticityProgram.program);
      bindQuad(vorticityProgram.program);
      gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
      gl.uniform1f(vorticityProgram.uniforms.curl, CONFIG.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      blit(velocity.write);
      velocity.swap();

      // Divergence.
      gl.useProgram(divergenceProgram.program);
      bindQuad(divergenceProgram.program);
      gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
      blit(divergence);

      // Pressure retention.
      gl.useProgram(clearProgram.program);
      bindQuad(clearProgram.program);
      gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
      gl.uniform1f(clearProgram.uniforms.value, CONFIG.PRESSURE);
      blit(pressure.write);
      pressure.swap();

      // Pressure solve.
      gl.useProgram(pressureProgram.program);
      bindQuad(pressureProgram.program);
      gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
      for (let i = 0; i < CONFIG.PRESSURE_ITERATIONS; i += 1) {
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
        blit(pressure.write);
        pressure.swap();
      }

      // Gradient subtract.
      gl.useProgram(gradientSubtractProgram.program);
      bindQuad(gradientSubtractProgram.program);
      gl.uniform2f(gradientSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
      gl.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
      blit(velocity.write);
      velocity.swap();

      // Advect velocity.
      gl.useProgram(advectionProgram.program);
      bindQuad(advectionProgram.program);
      gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      if (!supportLinear) {
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      } else {
        gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      }
      const velocityId = velocity.read.attach(0);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
      gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.VELOCITY_DISSIPATION * dt + 1.0 > 0 ? 1.0 / (1.0 + CONFIG.VELOCITY_DISSIPATION * dt) : 1.0);
      blit(velocity.write);
      velocity.swap();

      // Advect dye.
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
      gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
      gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
      gl.uniform1f(advectionProgram.uniforms.dissipation, 1.0 / (1.0 + CONFIG.DENSITY_DISSIPATION * dt));
      blit(dye.write);
      dye.swap();
    }

    /* -- bloom pipeline -- */
    function applyBloom(source, destination) {
      if (bloomFramebuffers.length < 2) return;
      let last = destination;

      gl.disable(gl.BLEND);

      // Prefilter into destination.
      gl.useProgram(bloomPrefilterProgram.program);
      bindQuad(bloomPrefilterProgram.program);
      const knee = CONFIG.BLOOM_THRESHOLD * CONFIG.BLOOM_SOFT_KNEE + 0.0001;
      const curve0 = CONFIG.BLOOM_THRESHOLD - knee;
      const curve1 = knee * 2;
      const curve2 = 0.25 / knee;
      gl.uniform3f(bloomPrefilterProgram.uniforms.curve, curve0, curve1, curve2);
      gl.uniform1f(bloomPrefilterProgram.uniforms.threshold, CONFIG.BLOOM_THRESHOLD);
      gl.uniform1i(bloomPrefilterProgram.uniforms.uTexture, source.attach(0));
      blit(last);

      // Iterative downsample.
      gl.useProgram(bloomBlurProgram.program);
      bindQuad(bloomBlurProgram.program);
      for (let i = 0; i < bloomFramebuffers.length; i += 1) {
        const dest = bloomFramebuffers[i];
        gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
        blit(dest);
        last = dest;
      }

      // Iterative upsample — additive.
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.enable(gl.BLEND);
      for (let i = bloomFramebuffers.length - 2; i >= 0; i -= 1) {
        const baseTex = bloomFramebuffers[i];
        gl.uniform2f(bloomBlurProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
        gl.uniform1i(bloomBlurProgram.uniforms.uTexture, last.attach(0));
        blit(baseTex);
        last = baseTex;
      }

      gl.disable(gl.BLEND);

      // Final.
      gl.useProgram(bloomFinalProgram.program);
      bindQuad(bloomFinalProgram.program);
      gl.uniform2f(bloomFinalProgram.uniforms.texelSize, last.texelSizeX, last.texelSizeY);
      gl.uniform1i(bloomFinalProgram.uniforms.uTexture, last.attach(0));
      gl.uniform1f(bloomFinalProgram.uniforms.intensity, CONFIG.BLOOM_INTENSITY);
      blit(destination);
    }

    /* -- sunrays pipeline -- */
    function applySunrays(source, mask, destination) {
      gl.disable(gl.BLEND);
      gl.useProgram(sunraysMaskProgram.program);
      bindQuad(sunraysMaskProgram.program);
      gl.uniform1i(sunraysMaskProgram.uniforms.uTexture, source.attach(0));
      blit(mask);

      gl.useProgram(sunraysProgram.program);
      bindQuad(sunraysProgram.program);
      gl.uniform1f(sunraysProgram.uniforms.weight, CONFIG.SUNRAYS_WEIGHT);
      gl.uniform1i(sunraysProgram.uniforms.uTexture, mask.attach(0));
      blit(destination);
    }

    function blur(target, temp, iterations) {
      gl.useProgram(blurProgram.program);
      bindQuad(blurProgram.program);
      for (let i = 0; i < iterations; i += 1) {
        gl.uniform2f(blurProgram.uniforms.texelSize, target.texelSizeX, 0.0);
        gl.uniform1i(blurProgram.uniforms.uTexture, target.attach(0));
        blit(temp);

        gl.uniform2f(blurProgram.uniforms.texelSize, 0.0, target.texelSizeY);
        gl.uniform1i(blurProgram.uniforms.uTexture, temp.attach(0));
        blit(target);
      }
    }

    /* -- render pass -- */
    function render() {
      if (CONFIG.BLOOM) applyBloom(dye.read, bloom);
      if (CONFIG.SUNRAYS) {
        applySunrays(dye.read, dye.write, sunrays);
        blur(sunrays, sunraysTemp, 1);
      }

      // Clear the default framebuffer to the background color.
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(CONFIG.BACK_COLOR.r, CONFIG.BACK_COLOR.g, CONFIG.BACK_COLOR.b, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Additive blend so the dye lights up over the dark background.
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);

      gl.useProgram(displayProgram.program);
      bindQuad(displayProgram.program);
      gl.uniform2f(displayProgram.uniforms.texelSize, 1.0 / gl.drawingBufferWidth, 1.0 / gl.drawingBufferHeight);
      gl.uniform1i(displayProgram.uniforms.uTexture, dye.read.attach(0));
      gl.uniform1i(displayProgram.uniforms.uBloom, bloom.attach(1));
      gl.uniform1i(displayProgram.uniforms.uSunrays, sunrays.attach(2));
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

      gl.disable(gl.BLEND);
    }

    /* -- main loop -- */
    let rafId = 0;
    let lastTime = performance.now();
    let running = true;

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) running = entry.isIntersecting;
      if (running) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    }, { threshold: 0 });
    io.observe(wrapper);

    function loop(now) {
      if (!running) return;
      const dt = Math.min(0.016666, (now - lastTime) / 1000);
      lastTime = now;

      if (pendingResize) {
        initFramebuffers();
        pendingResize = false;
      }

      maybeAutoSplat(now);

      if (pointer.moved) {
        splat(
          pointer.x, pointer.y,
          pointer.dx * CONFIG.SPLAT_FORCE,
          pointer.dy * CONFIG.SPLAT_FORCE,
          pointer.color,
        );
        pointer.moved = false;
      }

      step(dt);
      render();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    /* -- cleanup -- */
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      io.disconnect();
      ro.disconnect();
      wrapper.removeEventListener('pointermove', onPointerMove);
      wrapper.removeEventListener('pointerdown', onPointerDown);
      wrapper.removeEventListener('pointerleave', onPointerLeave);
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    };
  }, []);

  return (
    <div ref={wrapperRef} className={`${styles.wrapper}${className ? ` ${className}` : ''}`}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div className={styles.scrim} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
