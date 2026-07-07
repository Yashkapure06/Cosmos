import * as THREE from "three";

const TEX = 512;

function hash2D(x: number, y: number, s: number): number {
  let h = (s + x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2D(ix, iy, s);
  const n10 = hash2D(ix + 1, iy, s);
  const n01 = hash2D(ix, iy + 1, s);
  const n11 = hash2D(ix + 1, iy + 1, s);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

function fbm(x: number, y: number, oct: number, s: number): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * smoothNoise(x * f, y * f, s + i * 137);
    f *= 2;
    a *= 0.5;
  }
  return v;
}

function fillPixels(
  ctx: CanvasRenderingContext2D,
  fn: (x: number, y: number) => [number, number, number],
) {
  const img = ctx.createImageData(TEX, TEX);
  const d = img.data;
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * TEX + x) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function drawCrater(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rim: number,
  depth: number,
) {
  const g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
  g.addColorStop(0, `rgba(0,0,0,${depth})`);
  g.addColorStop(0.5, `rgba(0,0,0,${depth * 0.7})`);
  g.addColorStop(0.78, `rgba(255,255,255,${rim})`);
  g.addColorStop(0.92, `rgba(0,0,0,${depth * 0.2})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoulder(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  brightness: number,
) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(255,255,255,${brightness * 0.6})`);
  g.addColorStop(0.5, `rgba(128,128,128,${brightness * 0.3})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // shadow
  const sg = ctx.createRadialGradient(
    cx + r * 0.3,
    cy + r * 0.3,
    0,
    cx + r * 0.3,
    cy + r * 0.3,
    r * 0.8,
  );
  sg.addColorStop(0, `rgba(0,0,0,${brightness * 0.4})`);
  sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(cx + r * 0.3, cy + r * 0.3, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

function addCraters(
  ctx: CanvasRenderingContext2D,
  count: number,
  minR: number,
  maxR: number,
  rim: number,
  depth: number,
  seed: number,
) {
  for (let i = 0; i < count; i++) {
    const cx = hash2D(i, 0, seed) * TEX;
    const cy = hash2D(i, 1, seed) * TEX;
    const r = minR + hash2D(i, 2, seed + 1) * (maxR - minR);
    drawCrater(ctx, cx, cy, r, rim, depth);
  }
}

function addBoulders(
  ctx: CanvasRenderingContext2D,
  count: number,
  minR: number,
  maxR: number,
  brightness: number,
  seed: number,
) {
  for (let i = 0; i < count; i++) {
    const cx = hash2D(i * 7, 0, seed) * TEX;
    const cy = hash2D(i * 7, 1, seed) * TEX;
    const r = minR + hash2D(i * 7, 2, seed + 1) * (maxR - minR);
    drawBoulder(ctx, cx, cy, r, brightness);
  }
}

type TexFn = (ctx: CanvasRenderingContext2D, seed: number) => void;

const GENERATORS: TexFn[] = [
  // 0: C-type dark (carbonaceous) - very dark gray, subtle features
  (ctx, s) => {
    fillPixels(ctx, (x, y) => {
      const n = fbm(x / TEX * 6, y / TEX * 6, 5, s);
      const b = 28 + n * 22;
      return [b, b * 0.93, b * 0.88];
    });
    addCraters(ctx, 12, 6, 35, 0.1, 0.35, s + 10);
    addCraters(ctx, 20, 2, 8, 0.06, 0.2, s + 20);
  },

  // 1: C-type brown (carbonaceous, warmer) - dark brown-gray, cratered
  (ctx, s) => {
    fillPixels(ctx, (x, y) => {
      const n = fbm(x / TEX * 5, y / TEX * 5, 4, s);
      const b = 32 + n * 20;
      return [b, b * 0.85, b * 0.75];
    });
    addCraters(ctx, 18, 5, 45, 0.12, 0.4, s + 30);
    addCraters(ctx, 30, 2, 7, 0.05, 0.2, s + 40);
    addBoulders(ctx, 8, 3, 10, 0.08, s + 50);
  },

  // 2: S-type gray (silicate) - medium gray, rocky, cratered
  (ctx, s) => {
    fillPixels(ctx, (x, y) => {
      const n = fbm(x / TEX * 8, y / TEX * 8, 5, s);
      const b = 80 + n * 40;
      return [b, b * 0.94, b * 0.9];
    });
    addCraters(ctx, 15, 5, 40, 0.2, 0.35, s + 60);
    addCraters(ctx, 25, 2, 8, 0.1, 0.15, s + 70);
    addBoulders(ctx, 12, 3, 12, 0.15, s + 80);
  },

  // 3: S-type brown (silicate, weathered) - brownish stony regolith
  (ctx, s) => {
    fillPixels(ctx, (x, y) => {
      const n = fbm(x / TEX * 7, y / TEX * 7, 5, s);
      const b = 70 + n * 35;
      return [b, b * 0.82, b * 0.7];
    });
    addCraters(ctx, 14, 4, 38, 0.18, 0.3, s + 90);
    addCraters(ctx, 22, 2, 9, 0.08, 0.12, s + 100);
    addBoulders(ctx, 15, 2, 14, 0.18, s + 110);
  },

  // 4: S-type reddish (iron-rich silicate)
  (ctx, s) => {
    fillPixels(ctx, (x, y) => {
      const n = fbm(x / TEX * 6, y / TEX * 6, 5, s);
      const b = 75 + n * 30;
      return [b, b * 0.78, b * 0.65];
    });
    addCraters(ctx, 10, 6, 42, 0.22, 0.35, s + 120);
    addCraters(ctx, 18, 2, 10, 0.1, 0.15, s + 130);
    addBoulders(ctx, 10, 3, 11, 0.2, s + 140);
  },

  // 5: M-type metallic (nickel-iron) - gray with metallic speckle
  (ctx, s) => {
    fillPixels(ctx, (x, y) => {
      const n = fbm(x / TEX * 10, y / TEX * 10, 4, s);
      const speckle = fbm(x / TEX * 30 + 50, y / TEX * 30 + 50, 2, s + 200) * 0.3;
      const b = 90 + n * 25 + speckle * 40;
      return [b * 1.02, b * 0.95, b * 0.88];
    });
    addCraters(ctx, 8, 5, 30, 0.25, 0.3, s + 150);
    addCraters(ctx, 15, 2, 7, 0.12, 0.12, s + 160);
  },

  // 6: V-type basaltic (Vesta-like) - brighter gray, patchy albedo
  (ctx, s) => {
    fillPixels(ctx, (x, y) => {
      const n = fbm(x / TEX * 5, y / TEX * 5, 4, s);
      const patch = fbm(x / TEX * 3 + 100, y / TEX * 3 + 100, 3, s + 300) * 0.4;
      const b = 100 + n * 30 + patch * 50;
      return [b * 0.95, b * 0.96, b];
    });
    addCraters(ctx, 20, 4, 50, 0.3, 0.4, s + 170);
    addCraters(ctx, 30, 2, 8, 0.15, 0.2, s + 180);
    addBoulders(ctx, 6, 4, 15, 0.25, s + 190);
  },

  // 7: D-type primitive - very dark, reddish, featureless
  (ctx, s) => {
    fillPixels(ctx, (x, y) => {
      const n = fbm(x / TEX * 4, y / TEX * 4, 3, s);
      const b = 20 + n * 15;
      return [b * 1.1, b * 0.85, b * 0.7];
    });
    addCraters(ctx, 8, 5, 30, 0.05, 0.25, s + 210);
    addCraters(ctx, 12, 2, 6, 0.03, 0.15, s + 220);
  },

  // 8: Heavy regolith / boulder field - very rough, heavily cratered
  (ctx, s) => {
    fillPixels(ctx, (x, y) => {
      const n = fbm(x / TEX * 8, y / TEX * 8, 6, s);
      const rough = fbm(x / TEX * 15 + 200, y / TEX * 15 + 200, 3, s + 400) * 0.2;
      const b = 50 + n * 35 + rough * 40;
      return [b, b * 0.9, b * 0.82];
    });
    addCraters(ctx, 25, 3, 55, 0.15, 0.45, s + 230);
    addCraters(ctx, 40, 1, 7, 0.08, 0.2, s + 240);
    addBoulders(ctx, 25, 2, 18, 0.2, s + 250);
    addBoulders(ctx, 15, 1, 3, 0.1, s + 260);
  },

  // 9: Carbonaceous chondrite - dark with lighter inclusions
  (ctx, s) => {
    fillPixels(ctx, (x, y) => {
      const n = fbm(x / TEX * 6, y / TEX * 6, 4, s);
      const inclusion = fbm(x / TEX * 20 + 300, y / TEX * 20 + 300, 3, s + 500);
      const spot = inclusion > 0.5 ? inclusion * 0.6 : 0;
      const b = 30 + n * 20 + spot * 40;
      return [b * 0.98, b * 0.92, b * 0.85];
    });
    addCraters(ctx, 10, 5, 28, 0.08, 0.3, s + 270);
    addCraters(ctx, 15, 2, 6, 0.04, 0.15, s + 280);
    addBoulders(ctx, 5, 2, 8, 0.06, s + 290);
  },
];

export function generateAsteroidTextures(): THREE.CanvasTexture[] {
  return GENERATORS.map((gen, i) => {
    const c = document.createElement("canvas");
    c.width = TEX;
    c.height = TEX;
    const ctx = c.getContext("2d")!;
    gen(ctx, i * 777 + 1337);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  });
}
