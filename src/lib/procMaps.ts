// Procedural surface maps for major moons (no external texture files).
// Distinctive enough to read at a glance: Io sulfur, Europa cracks, etc.

import * as THREE from "three";

export type ProcSurface =
  | "io"
  | "europa"
  | "ganymede"
  | "callisto"
  | "titan"
  | "enceladus"
  | "iapetus"
  | "triton"
  | "miranda";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(u: number, v: number, scale: number, seed: number) {
  const x = u * scale;
  const y = v * scale;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(u: number, v: number, seed: number, oct = 5) {
  let a = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    a += amp * valueNoise(u, v, f * 6, seed + i * 97);
    amp *= 0.5;
    f *= 2;
  }
  return a;
}

type RGB = [number, number, number];

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function paint(
  kind: ProcSurface,
  u: number,
  v: number,
  rand: () => number,
): RGB {
  // v: 0 south pole → 1 north (canvas y flipped later)
  switch (kind) {
    case "io": {
      const n = fbm(u, v, 11);
      const vents = Math.pow(Math.max(0, n - 0.55), 1.6);
      const base = mix([210, 170, 40], [160, 90, 30], n);
      const sulfur = mix(base, [255, 230, 80], vents * 2);
      const dark = mix(sulfur, [90, 50, 30], Math.max(0, 0.4 - n) * 1.5);
      // hot spots
      if (rand() > 0.997) return [255, 80, 20];
      return dark;
    }
    case "europa": {
      const ice = mix([230, 220, 205], [190, 175, 155], fbm(u, v, 22));
      // linea cracks
      const crack =
        Math.abs(Math.sin(u * 40 + v * 8)) *
        Math.abs(Math.sin(v * 55 + u * 12));
      const line = crack > 0.85 ? 0.55 : crack > 0.7 ? 0.25 : 0;
      return mix(ice, [90, 70, 55], line);
    }
    case "ganymede": {
      const n = fbm(u, v, 33);
      const dark = [90, 75, 60] as RGB;
      const bright = [180, 165, 145] as RGB;
      let c = mix(dark, bright, smooth(n, 0.35, 0.65));
      // furrows
      const furrow = Math.abs(Math.sin((u + v) * 70));
      if (furrow > 0.92) c = mix(c, [140, 130, 115], 0.4);
      return c;
    }
    case "callisto": {
      const n = fbm(u * 1.2, v * 1.2, 44, 6);
      let c = mix([70, 60, 50], [130, 115, 95], n);
      // craters
      for (let k = 0; k < 3; k++) {
        const cx = hash2(k, 3, 99);
        const cy = hash2(k, 7, 101);
        const d = Math.hypot(u - cx, (v - cy) * 0.5);
        if (d < 0.08) c = mix(c, [40, 35, 30], 1 - d / 0.08);
      }
      return c;
    }
    case "titan": {
      const n = fbm(u, v, 55);
      const haze = mix([210, 150, 60], [160, 100, 40], n);
      // dark dunes / mare bands near equator
      const band = Math.exp(-Math.pow((v - 0.5) * 4, 2));
      return mix(haze, [70, 55, 35], band * (0.3 + n * 0.5));
    }
    case "enceladus": {
      let c = mix([245, 250, 252], [210, 220, 225], fbm(u, v, 66));
      // tiger stripes near south (v small)
      if (v < 0.28) {
        const stripe = Math.abs(Math.sin(u * 55 + v * 20));
        if (stripe > 0.78) c = mix(c, [40, 90, 120], 0.55);
      }
      return c;
    }
    case "iapetus": {
      const n = fbm(u, v, 77);
      // two-tone: leading hemisphere dark
      const darkSide = u < 0.5 ? 1 : 0;
      return mix(
        mix([210, 200, 185], [40, 30, 25], darkSide),
        [120, 100, 80],
        n * 0.25,
      );
    }
    case "triton": {
      const n = fbm(u, v, 88);
      let c = mix([180, 170, 160], [120, 140, 150], n);
      if (v > 0.75) c = mix(c, [230, 235, 240], (v - 0.75) * 4); // N polar cap
      return c;
    }
    case "miranda": {
      const n = fbm(u * 2, v * 2, 99, 6);
      let c = mix([160, 155, 145], [90, 85, 80], n);
      // coronae / cliff blocks
      const block = Math.floor(u * 8) ^ Math.floor(v * 6);
      if (block % 3 === 0) c = mix(c, [200, 195, 185], 0.35);
      return c;
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function smooth(x: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const cache = new Map<ProcSurface, THREE.CanvasTexture>();

export function makeProcSurface(kind: ProcSurface, size = 512): THREE.CanvasTexture {
  const hit = cache.get(kind);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const rand = rng(kind.length * 1337 + size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = 1 - y / size;
      const [r, g, b] = paint(kind, u, v, rand);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  cache.set(kind, tex);
  return tex;
}
