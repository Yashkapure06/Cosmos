// Marker ring, orbit path and floating label for the selected satellite.

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { engine } from "../engine/SatelliteEngine";
import { getSimNow, useStore } from "../store/useStore";
import { CATEGORY_COLOR } from "../lib/constants";
import { fmtKm } from "../lib/format";

export function SelectedSatellite() {
  const selectedIndex = useStore((s) => s.selectedIndex);
  const meta = useStore((s) => s.meta[s.selectedIndex]);
  const [orbit, setOrbit] = useState<Float32Array | null>(null);
  const [altText, setAltText] = useState("");

  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => new THREE.Vector3(), []);

  const color = meta ? CATEGORY_COLOR[meta.category] : "#ffb000";

  useEffect(() => {
    setOrbit(null);
    if (selectedIndex < 0) return;
    let cancelled = false;
    engine.requestOrbit(selectedIndex, getSimNow()).then((points) => {
      if (!cancelled) setOrbit(points);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIndex]);

  const orbitLine = useMemo(() => {
    if (!orbit) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(orbit, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geom, mat);
  }, [orbit, color]);

  useEffect(
    () => () => {
      if (orbitLine) {
        orbitLine.geometry.dispose();
        (orbitLine.material as THREE.Material).dispose();
      }
    },
    [orbitLine],
  );

  useFrame(({ camera, clock }) => {
    if (selectedIndex < 0 || !groupRef.current) return;
    const simNow = getSimNow();
    engine.positionOf(selectedIndex, simNow, pos);
    groupRef.current.position.copy(pos);

    const dist = camera.position.distanceTo(pos);
    const s = dist * 0.018;
    if (ringRef.current) {
      ringRef.current.quaternion.copy(camera.quaternion);
      ringRef.current.scale.setScalar(s);
    }
    if (pulseRef.current) {
      const t = (clock.elapsedTime % 1.6) / 1.6;
      pulseRef.current.quaternion.copy(camera.quaternion);
      pulseRef.current.scale.setScalar(s * (1 + t * 1.6));
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.5 * (1 - t);
    }
  });

  // low-rate label refresh
  useEffect(() => {
    if (selectedIndex < 0) return;
    const id = setInterval(() => {
      const live = engine.liveSample(selectedIndex, getSimNow());
      if (live) setAltText(fmtKm(live.altitudeKm));
    }, 500);
    return () => clearInterval(id);
  }, [selectedIndex]);

  if (selectedIndex < 0 || !meta) return null;

  return (
    <>
      {orbitLine && <primitive object={orbitLine} />}
      <group ref={groupRef}>
        <mesh ref={ringRef}>
          <ringGeometry args={[0.72, 0.85, 48]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.95}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh ref={pulseRef}>
          <ringGeometry args={[0.95, 1.0, 48]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <Html className="sat-label" center distanceFactor={undefined} zIndexRange={[10, 0]}>
          <div className="sat-label-inner" style={{ borderColor: color }}>
            <span className="sat-label-name">{meta.name}</span>
            {altText && <span className="sat-label-alt">{altText}</span>}
          </div>
        </Html>
      </group>
    </>
  );
}
