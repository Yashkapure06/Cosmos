import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import gsap from "gsap";
import { engine } from "../engine/SatelliteEngine";
import { getSimNow, useStore } from "../store/useStore";
import { BODY_IDS, minCameraDistance, type BodyId } from "../lib/bodies";
import { frames, offsetOf } from "./frames";

const tmpVec = new THREE.Vector3();

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const stage = useStore((s) => s.stage);
  const follow = useStore((s) => s.follow);
  const selectedIndex = useStore((s) => s.selectedIndex);
  const flyMode = useStore((s) => s.flyMode);

  const satPos = useMemo(() => new THREE.Vector3(), []);
  const prevTarget = useMemo(() => new THREE.Vector3(), []);
  const followingRef = useRef(false);
  const interactedRef = useRef(false);
  const keysRef = useRef(new Set<string>());
  const flyPitch = useRef(0);
  const flyYaw = useRef(0);

  // track keyboard
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current.add(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d", "q", "e"].includes(k)) {
        e.preventDefault();
      }
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      keysRef.current.clear();
    };
  }, []);

  // capture/release fly orientation
  useEffect(() => {
    if (flyMode) {
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
      flyYaw.current = e.y;
      flyPitch.current = e.x;
    }
  }, [flyMode, camera]);

  // cinematic approach once the catalog is live
  useEffect(() => {
    if (stage !== "ready" || interactedRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      camera.position.set(1.7, 1.15, 3.1);
      return;
    }
    gsap.fromTo(
      camera.position,
      { x: 0.2, y: 0.6, z: 8.5 },
      { x: 1.7, y: 1.15, z: 3.1, duration: 2.6, ease: "power3.inOut" },
    );
  }, [stage, camera]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (flyMode) {
      controls.enabled = false;

      const k = keysRef.current;
      const dist = camera.position.length();
      const speed = 0.02 + dist * 0.003;
      const lookSpeed = 0.015;

      // WASD = look (yaw / pitch)
      if (k.has("a")) flyYaw.current += lookSpeed;
      if (k.has("d")) flyYaw.current -= lookSpeed;
      if (k.has("w")) flyPitch.current = Math.min(Math.PI / 2, flyPitch.current + lookSpeed);
      if (k.has("s")) flyPitch.current = Math.max(-Math.PI / 2, flyPitch.current - lookSpeed);

      camera.quaternion.setFromEuler(
        new THREE.Euler(flyPitch.current, flyYaw.current, 0, "YXZ"),
      );

      // Arrow keys + Q/E = fly in full 3D
      const fwd = tmpVec.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const rgt = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

      const delta = new THREE.Vector3();
      if (k.has("arrowup")) delta.add(fwd);
      if (k.has("arrowdown")) delta.sub(fwd);
      if (k.has("arrowleft")) delta.sub(rgt);
      if (k.has("arrowright")) delta.add(rgt);
      if (k.has("q")) delta.sub(up);
      if (k.has("e")) delta.add(up);

      if (delta.length() > 0) {
        delta.normalize().multiplyScalar(speed);
        camera.position.add(delta);
      }

      if (followingRef.current) followingRef.current = false;
    } else {
      controls.enabled = true;

      // faster wheel travel at interplanetary distances
      controls.zoomSpeed =
        frames.cameraDist > 20000 ? 3.2 : frames.cameraDist > 500 ? 1.7 : 0.8;

      let nearest: BodyId = "sun";
      let bestD = Infinity;
      for (const id of BODY_IDS) {
        const d = controls.target.distanceTo(offsetOf(id, tmpVec));
        if (d < bestD) {
          bestD = d;
          nearest = id;
        }
      }
      controls.minDistance = minCameraDistance(nearest);

      if (follow && selectedIndex >= 0) {
        engine.positionOf(selectedIndex, getSimNow(), satPos).add(frames.earthOffset);
        if (!followingRef.current) {
          prevTarget.copy(controls.target);
          followingRef.current = true;
        }
        const delta = satPos.clone().sub(controls.target);
        camera.position.add(delta);
        controls.target.copy(satPos);
      } else if (followingRef.current) {
        followingRef.current = false;
        gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.2, ease: "power2.inOut" });
      }
      controls.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      panSpeed={0.9}
      maxDistance={1_500_000}
      zoomSpeed={0.8}
      enablePan
      screenSpacePanning
      onStart={() => {
        interactedRef.current = true;
        gsap.killTweensOf(camera.position);
      }}
    />
  );
}
