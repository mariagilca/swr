import {useEffect, useRef} from 'react';

const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/* eslint-disable */
const FRAG = `
precision highp float;
varying vec2 v_uv;

uniform float u_time;
uniform vec2  u_resolution;
uniform vec2  u_mouse;        // smoothed cursor (normalized 0..1)
uniform vec2  u_mouseTrail;   // delayed trail position
uniform float u_mouseAmt;     // 0..1, lerps when cursor enters/leaves

// ============================================================
//  Hash & simplex noise (IQ-flavored, robust on most GPUs)
// ============================================================
vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)),
           dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}

float snoise(vec2 p) {
  const float K1 = 0.366025404; // (sqrt(3)-1)/2
  const float K2 = 0.211324865; // (3-sqrt(3))/6
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2  o = vec2(m, 1.0 - m);
  vec2  b = a - o + K2;
  vec2  c = a - 1.0 + 2.0 * K2;
  vec3  h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
  vec3  n = h * h * h * h * vec3(
    dot(a, hash22(i)),
    dot(b, hash22(i + o)),
    dot(c, hash22(i + 1.0))
  );
  return dot(n, vec3(70.0));
}

// Rotation per octave so layers don't align — kills the "grid noise" look
const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

float fbm4(vec2 p) {
  float v = 0.0, a = 0.5;
  v += a * snoise(p); p = ROT * p * 2.02; a *= 0.5;
  v += a * snoise(p); p = ROT * p * 2.03; a *= 0.5;
  v += a * snoise(p); p = ROT * p * 2.01; a *= 0.5;
  v += a * snoise(p);
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  v += a * snoise(p); p = ROT * p * 2.02; a *= 0.5;
  v += a * snoise(p); p = ROT * p * 2.03; a *= 0.5;
  v += a * snoise(p);
  return v;
}

// Distance from p to segment (a,b) — used for capsule-shaped cursor influence
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
  return length(pa - ba * h);
}

// Reinhard-ish tonemap — gentle compression, preserves shadow detail
vec3 tonemap(vec3 c) {
  return c / (1.0 + c);
}

// Cheap screen-space dither to kill 8-bit banding in dark gradients
float dither(vec2 p) {
  return (fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (1.0 / 255.0);
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;

  // Aspect-corrected UV in flow space
  vec2 uv = v_uv;
  uv.x *= aspect;

  // Mouse positions in same coord space
  vec2 mp = u_mouse      * vec2(aspect, 1.0);
  vec2 mt = u_mouseTrail * vec2(aspect, 1.0);

  // ----------------------------------------------------------
  //  Cursor influence (capsule between current + trail)
  // ----------------------------------------------------------
  float dSeg = sdSegment(uv, mt, mp);
  float mCapsule = exp(-dSeg * dSeg * 14.0) * u_mouseAmt;

  vec2  toMouse = uv - mp;
  float dCur = length(toMouse);
  vec2  dir = toMouse / max(dCur, 1e-4);
  vec2  tangent = vec2(-dir.y, dir.x);
  float mPoint = exp(-dCur * dCur * 9.0) * u_mouseAmt;

  // ----------------------------------------------------------
  //  Time — very slow base + faster fine detail
  // ----------------------------------------------------------
  float tSlow = u_time * 0.011;
  float tFast = u_time * 0.025;

  // Slow "breathing" — modulates warp intensity
  float pulse = 0.5 + 0.5 * sin(u_time * 0.13);

  // ----------------------------------------------------------
  //  3-stage domain warp (Inigo Quilez technique)
  //  Each stage uses the previous as displacement input.
  // ----------------------------------------------------------
  vec2 mouseWarp = (-dir * 0.045 + tangent * (0.06 + 0.04 * pulse)) * mPoint;
  vec2 trailWarp = (mt - mp) * mCapsule * 0.10;

  // Stage 1 — large slow flow
  vec2 q = vec2(
    fbm4(uv * 0.55 + tSlow),
    fbm4(uv * 0.55 + vec2(5.2, 1.3) + tSlow * 0.8)
  );

  // Stage 2 — medium currents warped by stage 1
  vec2 p2 = uv + 1.7 * q + mouseWarp + trailWarp;
  vec2 r = vec2(
    fbm4(p2 + vec2(1.7, 9.2) + tSlow * 0.5),
    fbm4(p2 + vec2(8.3, 2.8) + tSlow * 0.4)
  );

  // Stage 3 — final field; warp magnitude breathes with the pulse
  float warpScale = 1.5 + 0.30 * pulse;
  vec2  p3 = uv + warpScale * r + 0.55 * mouseWarp;
  float baseField = fbm4(p3);

  // Fine surface detail
  float fine = fbm3(uv * 4.5 + tFast) * 0.18;
  baseField += fine;

  // ----------------------------------------------------------
  //  Palette — refined, mostly cool, sparse highlights
  // ----------------------------------------------------------
  vec3 cAbyss = vec3(0.004, 0.014, 0.040);
  vec3 cDeep  = vec3(0.020, 0.050, 0.110);
  vec3 cMid   = vec3(0.050, 0.115, 0.230);
  vec3 cTeal  = vec3(0.080, 0.380, 0.480);
  vec3 cIce   = vec3(0.580, 0.820, 0.880);

  // Build base color in steps with smoothstep transitions
  vec3 color = mix(cAbyss, cDeep, smoothstep(-0.70, 0.00, baseField));
  color      = mix(color,  cMid,  smoothstep(-0.10, 0.50, baseField));

  // Teal currents follow warp magnitude
  float tealMask = smoothstep(0.40, 1.30, length(r));
  color = mix(color, cTeal, tealMask * 0.42);

  // Caustic-like highlights — sharp peaks read as light through water
  float crests = pow(max(0.0, baseField - 0.22), 2.5) * 1.8;
  color += cIce * crests * 0.22;

  // Sub-surface shimmer from fine detail
  float shimmer = pow(max(0.0, fine), 2.0) * 4.0;
  color += cTeal * shimmer * 0.45;

  // ----------------------------------------------------------
  //  Cursor — subtle warm sheen, no bright pale ball
  // ----------------------------------------------------------
  vec3 cursorWarm = vec3(0.85, 0.55, 0.45);
  color += cursorWarm * mPoint * 0.18 * (0.6 + 0.4 * pulse);

  // Soft trail — slightly cooler than the head
  color += vec3(0.30, 0.55, 0.65) * pow(mCapsule, 1.8) * 0.08;

  // ----------------------------------------------------------
  //  Vignette + edge cooling
  // ----------------------------------------------------------
  vec2  vUv = v_uv - 0.5;
  float dEdge = length(vUv);
  float vig = smoothstep(1.00, 0.30, dEdge);
  color *= mix(0.55, 1.0, vig);
  color  = mix(color * vec3(0.65, 0.78, 1.00), color, vig);

  // ----------------------------------------------------------
  //  Tonemap, dither, output
  // ----------------------------------------------------------
  color = tonemap(color * 1.35);
  color += dither(gl_FragCoord.xy);

  gl_FragColor = vec4(color, 1.0);
}
`;
/* eslint-enable */

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    if (typeof console !== 'undefined') {
      console.warn('HeroFluid shader compile error:', gl.getShaderInfoLog(sh));
    }
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

const lerp = (a, b, k) => a + (b - a) * k;

export default function HeroFluid({className}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext('webgl', {antialias: false, premultipliedAlpha: false}) ||
      canvas.getContext('experimental-webgl');
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      if (typeof console !== 'undefined') {
        console.warn('HeroFluid link error:', gl.getProgramInfoLog(program));
      }
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'u_time');
    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');
    const uMouseTrail = gl.getUniformLocation(program, 'u_mouseTrail');
    const uMouseAmt = gl.getUniformLocation(program, 'u_mouseAmt');

    // Cap pixel ratio — fluid effect is low frequency, no need for full retina
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const w = Math.max(canvas.clientWidth, 1);
      const h = Math.max(canvas.clientHeight, 1);
      const pw = Math.floor(w * dpr);
      const ph = Math.floor(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        gl.viewport(0, 0, pw, ph);
        gl.uniform2f(uRes, pw, ph);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ----- Mouse tracking on the hero (canvas's parent) -----
    const target = canvas.parentElement || canvas;

    const targetMouse = [0.5, 0.5];
    const smoothMouse = [0.5, 0.5];
    const trailMouse = [0.5, 0.5];
    let targetAmt = 0;
    let smoothAmt = 0;

    const onMove = (e) => {
      const rect = target.getBoundingClientRect();
      targetMouse[0] = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      targetMouse[1] = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
      targetAmt = 1;
    };
    const onEnter = () => { targetAmt = 1; };
    const onLeave = () => {
      targetAmt = 0;
      // gently drift the cursor target back to center so the swirl unwinds
      targetMouse[0] = 0.5;
      targetMouse[1] = 0.5;
    };

    target.addEventListener('mousemove', onMove, {passive: true});
    target.addEventListener('mouseenter', onEnter, {passive: true});
    target.addEventListener('mouseleave', onLeave, {passive: true});

    // Touch support — most users won't trigger it but it's free
    const onTouch = (e) => {
      if (!e.touches || !e.touches.length) return;
      const t = e.touches[0];
      onMove(t);
    };
    target.addEventListener('touchmove', onTouch, {passive: true});
    target.addEventListener('touchstart', onTouch, {passive: true});
    target.addEventListener('touchend', onLeave, {passive: true});

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    const start = performance.now();

    const draw = (elapsed) => {
      // Cursor smoothing — head follows quickly, trail lags far behind
      const kHead = 0.075;
      const kTrail = 0.020;
      const kAmt = 0.035;

      smoothMouse[0] = lerp(smoothMouse[0], targetMouse[0], kHead);
      smoothMouse[1] = lerp(smoothMouse[1], targetMouse[1], kHead);
      trailMouse[0] = lerp(trailMouse[0], smoothMouse[0], kTrail);
      trailMouse[1] = lerp(trailMouse[1], smoothMouse[1], kTrail);
      smoothAmt = lerp(smoothAmt, targetAmt, kAmt);

      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, smoothMouse[0], smoothMouse[1]);
      gl.uniform2f(uMouseTrail, trailMouse[0], trailMouse[1]);
      gl.uniform1f(uMouseAmt, smoothAmt);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const tick = (now) => {
      draw((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };

    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const wasVisible = visible;
          visible = entry.isIntersecting;
          if (visible && !wasVisible && !reduced) {
            raf = requestAnimationFrame(tick);
          } else if (!visible && wasVisible) {
            cancelAnimationFrame(raf);
            raf = 0;
          }
        });
      },
      {threshold: 0},
    );
    io.observe(canvas);

    if (reduced) {
      gl.uniform1f(uMouseAmt, 0);
      draw(0);
    } else {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      target.removeEventListener('mousemove', onMove);
      target.removeEventListener('mouseenter', onEnter);
      target.removeEventListener('mouseleave', onLeave);
      target.removeEventListener('touchmove', onTouch);
      target.removeEventListener('touchstart', onTouch);
      target.removeEventListener('touchend', onLeave);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
