// Sub-satellite ground track (one orbit, ECEF) + live coverage footprint.
// Cheap: rebuild polyline on selection / epoch jump; footprint updates per frame.

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { eciToGeodetic, gstime, degreesLat, degreesLong } from "satellite.js";
import { engine } from "../engine/SatelliteEngine";
import { getSimNow, useStore } from "../store/useStore";
import { CATEGORY_COLOR, EARTH_RADIUS_KM } from "../lib/constants";
import { quality } from "../lib/quality";

const TRACK_R = 1.004;
const FOOT_R = 1.005;
const SAMPLES = 128;

function latLonToLocal(latDeg: number, lonDeg: number, r: number, out: THREE.Vector3) {
  // Body-fixed Y-up sphere matching Three SphereGeometry + Earth.rotation.y = gmst
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const c = Math.cos(lat);
  out.set(c * Math.cos(lon), Math.sin(lat), -c * Math.sin(lon)).multiplyScalar(r);
}

function sceneToEciKm(sx: number, sy: number, sz: number) {
  return {
    x: sx * EARTH_RADIUS_KM,
    y: -sz * EARTH_RADIUS_KM,
    z: sy * EARTH_RADIUS_KM,
  };
}

/** Horizon half-angle from sat altitude (Earth radius angular size). */
function footprintHalfAngle(altKm: number): number {
  const R = EARTH_RADIUS_KM;
  const h = Math.max(80, altKm);
  return Math.acos(Math.min(1, R / (R + h)));
}

export function GroundTrack() {
  const selectedIndex = useStore((s) => s.selectedIndex);
  const show = useStore((s) => s.showGroundTrack);
  const meta = useStore((s) => s.meta[s.selectedIndex]);
  const timeAnchor = useStore((s) => s.time.anchorSim);

  const [orbit, setOrbit] = useState<Float32Array | null>(null);
  const earthSpin = useRef<THREE.Group>(null);
  const footRef = useRef<THREE.Mesh>(null);
  const coneRef = useRef<THREE.Mesh>(null);
  const nadirRef = useRef<THREE.Mesh>(null);
  const scratch = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      local: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      yAxis: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );

  const color = meta ? CATEGORY_COLOR[meta.category] : "#ffb000";

  useEffect(() => {
    setOrbit(null);
    if (selectedIndex < 0 || !show) return;
    let cancelled = false;
    engine.requestOrbit(selectedIndex, getSimNow(), SAMPLES).then((points) => {
      if (!cancelled) setOrbit(points);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIndex, show, timeAnchor]);

  const trackLine = useMemo(() => {
    if (!orbit || !meta) return null;
    const sim0 = getSimNow();
    const periodMs = Math.max(60_000, meta.periodMin * 60_000);
    const n = orbit.length / 3;
    const positions = new Float32Array(n * 3);
    const v = new THREE.Vector3();

    for (let s = 0; s < n; s++) {
      const j = s * 3;
      const t = sim0 + (s / Math.max(1, n - 1)) * periodMs;
      const eci = sceneToEciKm(orbit[j], orbit[j + 1], orbit[j + 2]);
      if (eci.x === 0 && eci.y === 0 && eci.z === 0) continue;
      const gmst = gstime(new Date(t));
      const geo = eciToGeodetic(eci, gmst);
      latLonToLocal(degreesLat(geo.latitude), degreesLong(geo.longitude), TRACK_R, v);
      positions[j] = v.x;
      positions[j + 1] = v.y;
      positions[j + 2] = v.z;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Line(geom, mat);
  }, [orbit, meta, color]);

  useEffect(
    () => () => {
      if (trackLine) {
        trackLine.geometry.dispose();
        (trackLine.material as THREE.Material).dispose();
      }
    },
    [trackLine],
  );

  const footGeom = useMemo(() => new THREE.CircleGeometry(1, 64), []);
  const coneGeom = useMemo(() => new THREE.ConeGeometry(1, 1, 48, 1, true), []);

  useEffect(
    () => () => {
      footGeom.dispose();
      coneGeom.dispose();
    },
    [footGeom, coneGeom],
  );

  useFrame(() => {
    if (selectedIndex < 0 || !show || !meta) return;
    const simNow = getSimNow();
    const gmst = gstime(new Date(simNow));
    if (earthSpin.current) earthSpin.current.rotation.y = gmst;

    const live = engine.liveSample(selectedIndex, simNow);
    if (!live) return;

    engine.positionOf(selectedIndex, simNow, scratch.pos);
    latLonToLocal(live.latitudeDeg, live.longitudeDeg, FOOT_R, scratch.local);

    if (nadirRef.current) {
      nadirRef.current.position.copy(scratch.local);
      nadirRef.current.lookAt(0, 0, 0);
      nadirRef.current.rotateX(Math.PI / 2);
    }

    const half = footprintHalfAngle(live.altitudeKm);
    const radius = Math.sin(half) * FOOT_R;
    if (footRef.current) {
      footRef.current.position.copy(scratch.local);
      footRef.current.lookAt(0, 0, 0);
      footRef.current.rotateX(-Math.PI / 2);
      footRef.current.scale.setScalar(radius);
      (footRef.current.material as THREE.MeshBasicMaterial).opacity = quality.glow
        ? 0.22
        : 0.14;
    }

    if (coneRef.current) {
      const sat = scratch.pos;
      const alt = sat.length();
      const h = Math.max(0.02, alt - 1);
      const baseR = Math.tan(half) * h;
      coneRef.current.position.copy(sat).multiplyScalar((1 + alt) / (2 * Math.max(alt, 1e-6)));
      coneRef.current.scale.set(baseR, h, baseR);
      scratch.dir.copy(sat).normalize();
      coneRef.current.quaternion.setFromUnitVectors(scratch.yAxis, scratch.dir);
      coneRef.current.rotateX(Math.PI);
      (coneRef.current.material as THREE.MeshBasicMaterial).opacity = quality.glow
        ? 0.12
        : 0.07;
    }
  });

  if (selectedIndex < 0 || !show || !meta) return null;

  return (
    <>
      <group ref={earthSpin}>
        {trackLine && <primitive object={trackLine} />}
        <mesh ref={footRef} geometry={footGeom} renderOrder={2}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh ref={nadirRef} renderOrder={3}>
          <ringGeometry args={[0.012, 0.02, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.95}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
      <mesh ref={coneRef} geometry={coneGeom} renderOrder={1}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}
