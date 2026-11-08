import type React from 'react';
import { type CSSProperties, useEffect, useRef } from 'react';

export interface AuroraAtmosphereProps {
  colorStops?: string[];
  amplitude?: number;
  blend?: number;
  speed?: number;
  time?: number;
  height?: number;
  scale?: number;
  glow?: number;
  brightness?: number;
  layers?: number;
  direction?: 'top' | 'bottom';
  mouseInteraction?: boolean;
  intro?: boolean;
  opacity?: number;
  lightMode?: boolean;
  paused?: boolean;
  dpr?: number;
  className?: string;
  style?: CSSProperties;
}

type Settings = {
  stops: string[];
  amplitude: number;
  blend: number;
  speed: number;
  time?: number;
  height: number;
  scale: number;
  glow: number;
  brightness: number;
  layers: number;
  flip: number;
  mouseInteraction: boolean;
  intro: boolean;
  opacity: number;
  lightMode: boolean;
  paused: boolean;
  dpr?: number;
};

type Program = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> };

const MAX_STOPS = 5;
const MAX_LAYERS = 3;
const INTRO_SECONDS = 2.4;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uStops[${MAX_STOPS}];
uniform int uStopCount;
uniform float uAmplitude;
uniform float uBlend;
uniform float uHeight;
uniform float uScale;
uniform float uGlow;
uniform float uBrightness;
uniform int uLayers;
uniform float uFlip;
uniform vec3 uPointer;
uniform float uReveal;
uniform float uOpacity;
uniform float uLightMode;
out vec4 outColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float smootherstep(float edge0, float edge1, float x) {
  float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec3 ramp(float t) {
  float x = clamp(t, 0.0, 1.0) * float(uStopCount - 1);
  int i = int(min(floor(x), float(uStopCount - 2)));
  float f = x - float(i);
  f = f * f * (3.0 - 2.0 * f);
  vec3 lch = mix(uStops[i], uStops[i + 1], f);
  lch.x = mix(lch.x, min(lch.x, 0.7), uLightMode);
  return toSrgb(oklabToLinear(vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z))));
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float y = 1.0 - frag.y / uResolution.y;
  y = mix(y, 1.0 - y, uFlip);
  float u = frag.x / uResolution.x;
  float X = (frag.x - uResolution.x * 0.5) / uResolution.y;
  float t = uTime;
  float reach = uPointer.z * exp(-pow((X - uPointer.x) / 0.38, 2.0));

  vec3 glow = vec3(0.0);
  float cover = 0.0;
  for (int k = 0; k < ${MAX_LAYERS}; k++) {
    if (k >= uLayers) break;
    float layer = float(k);
    float seed = layer * 13.7;
    float pace = t * (1.0 - layer * 0.18);
    float warp = snoise(vec2(X * 0.45 * uScale + pace * 0.02 + seed, pace * 0.05 + seed));
    float wave = snoise(vec2(X * 0.95 * uScale + pace * 0.06 + seed, warp * 0.55 + pace * 0.04));
    float crest = snoise(vec2(X * 2.2 * uScale - pace * 0.11 + seed, wave * 0.75));

    float drift = (uPointer.y - 0.5) * 0.45 * reach;
    float shape = uHeight + (layer * 0.09) + (warp * 0.14 + wave * 0.11 + crest * 0.045) * uAmplitude + drift;
    float cutoff = mix(shape * 1.25, shape, uReveal);
    float span = max(0.001, uBlend * (1.0 + layer * 0.35));
    float fill = 1.0 - smootherstep(cutoff - span, cutoff + span, y);
    float aura = exp(-abs(y - cutoff) / span);
    vec3 col = ramp(clamp(u + warp * 0.15 + (layer - 1.0) * 0.18, 0.0, 1.0));

    glow += col * (fill + aura * uGlow) * uBrightness;
    cover = max(cover, fill);
  }

  float edge = cover * (1.0 - smootherstep(0.7, 1.0, y));
  glow += vec3(hash(frag + vec2(t * 12.0, -t * 7.0)) - 0.5) * (0.015 / 255.0);
  outColor = vec4(glow, max(0.0, edge * uOpacity));
}`;

function parseHex(hex: string): [number, number, number] {
  const c = hex.replace('#', '').trim();
  const n = Number.parseInt(
    c.length === 3
      ? c
          .split('')
          .map((x) => x + x)
          .join('')
      : c,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function hexToLch(hex: string): [number, number, number] {
  const [r, g, b] = parseHex(hex);
  const [L, a, b_] = rgbToOklab(r, g, b);
  const C = Math.hypot(a, b_);
  const h = Math.atan2(b_, a);
  return [L, C, h];
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export const AuroraAtmosphere: React.FC<AuroraAtmosphereProps> = ({
  colorStops = ['#0B0F19', '#7C3AED', '#A855F7', '#3B82F6', '#14B8A6'],
  amplitude = 1.0,
  blend = 0.5,
  speed = 0.8,
  time,
  height = 0.5,
  scale = 1.0,
  glow = 0.6,
  brightness = 0.85,
  layers = 3,
  direction = 'top',
  mouseInteraction = true,
  intro = true,
  opacity = 0.65,
  lightMode = false,
  paused = false,
  dpr,
  className = '',
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeRef = useRef<(() => void) | null>(null);

  const settingsRef = useRef<Settings>({
    stops: colorStops,
    amplitude,
    blend,
    speed,
    time,
    height,
    scale,
    glow,
    brightness,
    layers,
    flip: direction === 'bottom' ? 1 : 0,
    mouseInteraction,
    intro,
    opacity,
    lightMode,
    paused,
    dpr,
  });

  settingsRef.current = {
    stops: colorStops,
    amplitude,
    blend,
    speed,
    time,
    height,
    scale,
    glow,
    brightness,
    layers,
    flip: direction === 'bottom' ? 1 : 0,
    mouseInteraction,
    intro,
    opacity,
    lightMode,
    paused,
    dpr,
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;

    const compileShader = (type: number, source: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return;

    const programObj = gl.createProgram();
    if (!programObj) return;
    gl.attachShader(programObj, vs);
    gl.attachShader(programObj, fs);
    gl.linkProgram(programObj);
    if (!gl.getProgramParameter(programObj, gl.LINK_STATUS)) {
      gl.deleteProgram(programObj);
      return;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const uniformNames = [
      'uResolution',
      'uTime',
      'uStopCount',
      'uAmplitude',
      'uBlend',
      'uHeight',
      'uScale',
      'uGlow',
      'uBrightness',
      'uLayers',
      'uFlip',
      'uPointer',
      'uReveal',
      'uOpacity',
      'uLightMode',
      'uStops[0]',
    ];

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(programObj, name);
    }
    const program: Program = { program: programObj, uniforms };

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const posLoc = gl.getAttribLocation(program.program, 'aPosition');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const state = {
      clock: 0,
      px: 0,
      py: 0,
      reach: 0,
      reveal: settingsRef.current.intro ? 0 : 1,
    };
    const pointer = { x: 0, y: 0, inside: false };
    const view = { width: 0, height: 0 };
    let raf = 0;
    let last = 0;
    let visible = true;
    let reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = (e: MediaQueryListEvent) => {
      reduce = e.matches;
    };
    media.addEventListener('change', onMotion);

    const render = () => {
      const s = settingsRef.current;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program.program);
      gl.uniform2f(program.uniforms.uResolution ?? null, canvas.width, canvas.height);
      gl.uniform1f(program.uniforms.uTime ?? null, s.time ?? state.clock);
      gl.uniform1f(program.uniforms.uAmplitude ?? null, s.amplitude);
      gl.uniform1f(program.uniforms.uBlend ?? null, s.blend);
      gl.uniform1f(program.uniforms.uHeight ?? null, s.height);
      gl.uniform1f(program.uniforms.uScale ?? null, s.scale);
      gl.uniform1f(program.uniforms.uGlow ?? null, s.glow);
      gl.uniform1f(program.uniforms.uBrightness ?? null, s.brightness);
      gl.uniform1i(program.uniforms.uLayers ?? null, clamp(s.layers, 1, MAX_LAYERS));
      gl.uniform1f(program.uniforms.uFlip ?? null, s.flip);
      gl.uniform3f(program.uniforms.uPointer ?? null, state.px, state.py, state.reach);
      gl.uniform1f(program.uniforms.uReveal ?? null, state.reveal);
      gl.uniform1f(program.uniforms.uOpacity ?? null, s.opacity);
      gl.uniform1f(program.uniforms.uLightMode ?? null, s.lightMode ? 1 : 0);

      const rawStops = s.stops.slice(0, MAX_STOPS);
      const stops: [number, number, number][] = rawStops.map(hexToLch);
      while (stops.length < MAX_STOPS) stops.push([0, 0, 0]);
      gl.uniform1i(program.uniforms.uStopCount ?? null, rawStops.length);
      gl.uniform3fv(program.uniforms['uStops[0]'] ?? null, stops.flat());

      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const s = settingsRef.current;
      const dt = last ? clamp((now - last) / 1000, 0.0005, 0.05) : 1 / 60;
      last = now;
      if (s.paused) {
        state.reveal = 1;
        render();
        last = 0;
        return;
      }
      const motion = reduce ? 0 : 1;
      state.clock += dt * s.speed * motion;
      const engaged = s.mouseInteraction && pointer.inside && !reduce;
      const follow = 1 - Math.exp(-dt / 0.6);
      if (engaged) {
        const tx = (pointer.x - view.width / 2) / view.height;
        const ty = s.flip ? 1 - pointer.y / view.height : pointer.y / view.height;
        state.px += (tx - state.px) * follow;
        state.py += (ty - state.py) * follow;
      }
      state.reach +=
        ((engaged ? 1 : 0) - state.reach) * (1 - Math.exp(-dt / (engaged ? 0.9 : 1.4)));
      if (!s.intro || reduce) state.reveal = 1;
      else if (state.reveal < 1) state.reveal = Math.min(1, state.reveal + dt / INTRO_SECONDS);
      render();
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const s = settingsRef.current;
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const ratio = Math.min(s.dpr || window.devicePixelRatio || 1, 2);
      view.width = width;
      view.height = height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      render();
      wake();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      const wasInside = pointer.inside;
      pointer.inside =
        pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
      if (pointer.inside && !wasInside) {
        const s = settingsRef.current;
        state.px = (pointer.x - rect.width / 2) / Math.max(1, rect.height);
        state.py = s.flip
          ? 1 - pointer.y / Math.max(1, rect.height)
          : pointer.y / Math.max(1, rect.height);
      }
      if (!settingsRef.current.paused) wake();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') pointer.inside = false;
    };

    const onPointerLeave = () => {
      pointer.inside = false;
    };

    const onVisibility = () => {
      last = 0;
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        last = 0;
        wake();
      }
    });
    intersection.observe(container);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    resize();

    let lastDpr = settingsRef.current.dpr;
    wakeRef.current = () => {
      const s = settingsRef.current;
      if (s.dpr !== lastDpr) {
        lastDpr = s.dpr;
        resize();
        return;
      }
      if (!raf) render();
      wake();
    };

    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      media.removeEventListener('change', onMotion);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(program.program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  useEffect(() => {
    wakeRef.current?.();
  });

  return (
    <div
      ref={containerRef}
      className={['relative h-full w-full overflow-hidden', className].filter(Boolean).join(' ')}
      style={style}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full pointer-events-none"
      />
    </div>
  );
};

export default AuroraAtmosphere;
