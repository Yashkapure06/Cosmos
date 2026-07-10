// Constellation stick figures over the real starfield, the 12 zodiac figures
// highlighted in the app's amber, plus the ecliptic circle -- the sun's
// apparent path -- so you can SEE why those 12 are "the zodiac": they're the
// constellations the ecliptic runs through. Toggleable from the filter rail.

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  loadConstellations,
  raDecToDir,
  ZODIAC_IDS,
  type ConstellationLines,
  type ConstellationName,
} from "../lib/sky";
import { useStore } from "../store/useStore";
import { STAR_SHELL } from "./RealStars";

const SHELL = STAR_SHELL * 0.985; // just inside the stars

const OBLIQUITY = (23.4392811 * Math.PI) / 180;

function eclipticDir(lonDeg: number, out: THREE.Vector3): THREE.Vector3 {
  const l = (lonDeg * Math.PI) / 180;
  const x = Math.cos(l);
  const y = Math.sin(l) * Math.cos(OBLIQUITY);
  const z = Math.sin(l) * Math.sin(OBLIQUITY);
  return out.set(x, z, -y);
}

function buildSegments(sets: ConstellationLines[], filter: (id: string) => boolean) {
  const pts: number[] = [];
  const dir = new THREE.Vector3();
  for (const c of sets) {
    if (!filter(c.id)) continue;
    for (const line of c.lines) {
      for (let i = 0; i < line.length - 1; i++) {
        raDecToDir(line[i][0], line[i][1], dir);
        pts.push(dir.x * SHELL, dir.y * SHELL, dir.z * SHELL);
        raDecToDir(line[i + 1][0], line[i + 1][1], dir);
        pts.push(dir.x * SHELL, dir.y * SHELL, dir.z * SHELL);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
  return g;
}

export function Constellations() {
  const groupRef = useRef<THREE.Group>(null);
  const show = useStore((s) => s.showConstellations);
  const [data, setData] = useState<{
    lines: ConstellationLines[];
    names: ConstellationName[];
  } | null>(null);

  useEffect(() => {
    let alive = true;
    loadConstellations().then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, []);

  const geoms = useMemo(() => {
    if (!data) return null;
    return {
      regular: buildSegments(data.lines, (id) => !ZODIAC_IDS.has(id)),
      zodiac: buildSegments(data.lines, (id) => ZODIAC_IDS.has(id)),
    };
  }, [data]);

  // the ecliptic: closed circle through the zodiac band ("line" clashes with
  // the SVG element in JSX, so build the THREE.Line imperatively)
  const eclipticLine = useMemo(() => {
    const N = 240;
    const pts = new Float32Array((N + 1) * 3);
    const dir = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      eclipticDir((i / N) * 360, dir);
      pts[i * 3] = dir.x * SHELL;
      pts[i * 3 + 1] = dir.y * SHELL;
      pts[i * 3 + 2] = dir.z * SHELL;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const line = new THREE.Line(
      g,
      new THREE.LineBasicMaterial({
        color: "#ffb000",
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    line.frustumCulled = false;
    line.renderOrder = -8;
    return line;
  }, []);

  const zodiacNames = useMemo(
    () => (data ? data.names.filter((n) => ZODIAC_IDS.has(n.id)) : []),
    [data],
  );

  const labelDirs = useMemo(() => {
    const v = new THREE.Vector3();
    return zodiacNames.map((n) => raDecToDir(n.at[0], n.at[1], v.clone()).multiplyScalar(SHELL * 0.97));
  }, [zodiacNames]);

  useEffect(
    () => () => {
      geoms?.regular.dispose();
      geoms?.zodiac.dispose();
    },
    [geoms],
  );

  useFrame(({ camera }) => {
    groupRef.current?.position.copy(camera.position);
  });

  if (!geoms) return null;

  return (
    <group ref={groupRef} visible={show}>
      <lineSegments geometry={geoms.regular} frustumCulled={false} renderOrder={-8}>
        <lineBasicMaterial
          color="#44608a"
          transparent
          opacity={0.34}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <lineSegments geometry={geoms.zodiac} frustumCulled={false} renderOrder={-8}>
        <lineBasicMaterial
          color="#ffb000"
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <primitive object={eclipticLine} />
      {show &&
        zodiacNames.map((n, i) => (
          <group key={n.id} position={labelDirs[i]}>
            <Html center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
              <span className="constellation-label">{n.name.toUpperCase()}</span>
            </Html>
          </group>
        ))}
    </group>
  );
}
