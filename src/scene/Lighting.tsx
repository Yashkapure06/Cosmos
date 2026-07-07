// Sun-tracking key light for standard-material meshes (craft, asteroids).
// Custom-shader bodies (planets, Sun) compute their own lighting per-object
// and ignore scene lights entirely, so this is safe to render unconditionally.
//
// The light's target is explicitly steered at the camera (not left at the
// default world origin, and not at the orbit target either): when focus IS
// the sun, both offsetOf('sun') and the orbit target sit at (0,0,0) -- the
// same point as the light's position -- which collapses the light's
// direction vector to zero and renders everything pitch black. The camera
// is never at the sun's exact position, so it's a safe, always-valid aim.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { offsetOf } from "./frames";

export function SunLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (lightRef.current) lightRef.current.target = target;
  }, [target]);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    offsetOf("sun", light.position);
    target.position.copy(camera.position);
    target.updateMatrixWorld();
  });

  return (
    <>
      <primitive object={target} />
      <directionalLight ref={lightRef} intensity={2.6} />
      <ambientLight intensity={0.22} />
    </>
  );
}
