// A real 3D Milky Way. The photographic skybox (StarField) is what the galaxy
// looks like from inside; this is the galaxy itself as an object in space --
// a ~43k-point spiral pinned in the direction of Sagittarius A*, its disk
// oriented by the true galactic pole, so its glow lines up with the milky-way
// band in the skybox. Fly past the black hole and keep going: the arms, the
// amber bar, the pink HII regions and the halo all resolve in parallax.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { offsetOf } from "./frames";

// direction of the galactic centre (Sgr A*), EQJ RA/Dec -> scene
const CENTER_DIR = ((): THREE.Vector3 => {
  const ra = (266.417 * Math.PI) / 180;
  const dec = (-28.936 * Math.PI) / 180;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  return new THREE.Vector3(x, z, -y);
})();

// galactic north pole (RA 192.859, Dec +27.128) -> scene: the disk normal
const POLE = ((): THREE.Vector3 => {
  const ra = (192.859 * Math.PI) / 180;
  const dec = (27.128 * Math.PI) / 180;
  const x = Math.cos(dec) * Math.cos(ra);
  const y = Math.cos(dec) * Math.sin(ra);
  const z = Math.sin(dec);
  return new THREE.Vector3(x, z, -y);
})();

const CENTER_DIST = 3_200_000; // scene units (well past the black hole)
const R = 1_100_000; // disk radius
const ARMS = 4;
const PITCH = Math.tan((13 * Math.PI) / 180); // spiral pitch angle

const N_DISK = 30000;
const N_BULGE = 9000;
const N_HII = 1400;
const N_HALO = 2600;
const COUNT = N_DISK + N_BULGE + N_HII + N_HALO;

const GALAXY_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float px = aSize * uPixelRatio * 3200000.0 / -mv.z;
    gl_PointSize = clamp(px, 1.0, 10.0);
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const GALAXY_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform float uAlpha;
  varying vec3 vColor;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * core * core, core * uAlpha);
  }
`;

function rngFrom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller
function makeGauss(rand: () => number) {
  return () =>
    Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) *
    Math.cos(2 * Math.PI * rand());
}

function makeCoreTexture(): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,235,200,0.85)");
  g.addColorStop(0.2, "rgba(255,215,160,0.4)");
  g.addColorStop(0.55, "rgba(230,180,130,0.1)");
  g.addColorStop(1, "rgba(200,150,110,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Galaxy() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const { geometry, quaternion, position } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const rand = rngFrom(0x9e3779b9);
    const gauss = makeGauss(rand);

    const cWarm = new THREE.Color("#ffd9a8");
    const cBlue = new THREE.Color("#a8c4ff");
    const cDisk = new THREE.Color("#e8e2d8");
    const cBulge = new THREE.Color("#ffcf96");
    const cHII = new THREE.Color("#ff9bb8");
    const cHalo = new THREE.Color("#cdd4e8");
    const col = new THREE.Color();

    let i = 0;
    const put = (x: number, y: number, z: number, c: THREE.Color, size: number) => {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = size;
      i++;
    };

    // spiral disk: exponential radial profile wound into ARMS log-spiral arms
    const scaleLen = 0.36 * R;
    for (let k = 0; k < N_DISK; k++) {
      let r = -Math.log(1 - rand()) * scaleLen;
      if (r > R) r = rand() * R; // re-scatter the far tail
      const arm = (k % ARMS) * ((2 * Math.PI) / ARMS);
      const wind = Math.log(Math.max(r, 0.02 * R) / (0.06 * R)) / PITCH;
      // angular scatter grows toward the rim so arms stay crisp inside
      const scatter = gauss() * (0.14 + 0.22 * (r / R));
      const theta = arm + wind + scatter;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      const z = gauss() * 0.035 * R * (1 - 0.5 * (r / R));
      // young blue stars trace arm centres; the rest of the disk is older
      const armPurity = Math.exp(-scatter * scatter * 14);
      col.copy(cDisk).lerp(cBlue, armPurity * 0.85);
      if (r < 0.28 * R) col.lerp(cWarm, 1 - r / (0.28 * R));
      const m = rand();
      put(x, z, y, col, 0.5 + Math.pow(m, 5) * 2.6);
    }

    // bulge + bar: flattened gaussian blob, elongated along the bar axis
    for (let k = 0; k < N_BULGE; k++) {
      const x = gauss() * 0.16 * R * 1.7; // bar elongation
      const y = gauss() * 0.11 * R;
      const z = gauss() * 0.07 * R;
      col.copy(cBulge).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
      const m = rand();
      put(x, z, y, col, 0.6 + Math.pow(m, 4) * 2.2);
    }

    // HII regions: pink knots pinned tight to the arm centres
    for (let k = 0; k < N_HII; k++) {
      const r = (0.15 + 0.8 * rand()) * R;
      const arm = (k % ARMS) * ((2 * Math.PI) / ARMS);
      const wind = Math.log(Math.max(r, 0.02 * R) / (0.06 * R)) / PITCH;
      const theta = arm + wind + gauss() * 0.05;
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      const z = gauss() * 0.02 * R;
      put(x, z, y, cHII, 1.2 + rand() * 2.0);
    }

    // stellar halo: sparse, faint, old
    for (let k = 0; k < N_HALO; k++) {
      const u = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const rr = Math.pow(rand(), 0.5) * 0.95 * R;
      const rxy = Math.sqrt(1 - u * u) * rr;
      col.copy(cHalo).multiplyScalar(0.5 + rand() * 0.3);
      put(Math.cos(phi) * rxy, u * rr * 0.85, Math.sin(phi) * rxy, col, 0.4 + rand() * 0.8);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    // orient the disk: local +Y (disk normal) -> true galactic pole
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      POLE.clone().normalize(),
    );
    const position = CENTER_DIR.clone().multiplyScalar(CENTER_DIST);
    return { geometry: g, quaternion, position };
  }, []);

  const uniforms = useMemo(
    () => ({
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uAlpha: { value: 0.55 },
    }),
    [],
  );

  const coreTex = useMemo(() => makeCoreTexture(), []);
  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const g = groupRef.current;
    if (!g) return;
    // heliocentric anchor mapped into the current focus frame
    offsetOf("sun", g.position).add(position);
    // brighten as you actually approach: subtle from home, grand up close
    const d = scratch.copy(camera.position).sub(g.position).length();
    const u = matRef.current?.uniforms;
    if (u)
      u.uAlpha.value = THREE.MathUtils.lerp(
        0.85,
        0.4,
        THREE.MathUtils.smoothstep(d, 1_200_000, 3_400_000),
      );
  });

  return (
    <group ref={groupRef} quaternion={quaternion}>
      <points geometry={geometry} frustumCulled={false} renderOrder={-8}>
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={GALAXY_VERT}
          fragmentShader={GALAXY_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* soft amber glow over the bulge */}
      <sprite scale={[0.6 * R, 0.42 * R, 1]} renderOrder={-8}>
        <spriteMaterial
          map={coreTex}
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}
