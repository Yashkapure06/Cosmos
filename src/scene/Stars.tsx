import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";

export function StarField() {
  const milkyWay = useTexture("/textures/stars_milky_way_8k.jpg");
  const ref = useRef<THREE.Mesh>(null);

  useMemo(() => {
    milkyWay.colorSpace = THREE.SRGBColorSpace;
    milkyWay.needsUpdate = true;
  }, [milkyWay]);

  // the sky sphere follows the camera: infinitely far backdrop at any zoom
  useFrame(({ camera }) => {
    ref.current?.position.copy(camera.position);
  });

  return (
    <mesh ref={ref} rotation={[0, 0, 0.4]} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[9000, 48, 48]} />
      <meshBasicMaterial
        map={milkyWay}
        side={THREE.BackSide}
        color={new THREE.Color(0.5, 0.5, 0.55)}
        depthWrite={false}
      />
    </mesh>
  );
}
