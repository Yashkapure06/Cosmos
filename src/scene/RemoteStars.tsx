// Renderers for stars that aren't the Sun (TRAPPIST-1, Proxima, Alpha Cen):
// a self-luminous disc with limb darkening + soft additive glow sprites.
// Much simpler than the Sun's full lava shader -- these are viewed briefly
// and mostly serve as anchors for their planetary systems.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BODIES, BODY_IDS, type BodyDef, type BodyId } from "../lib/bodies";
import { offsetOf } from "./frames";

const STAR_IDS: BodyId[] = BODY_IDS.filter(
  (id) => BODIES[id].type === "star" && id !== "sun",
);

const STAR_VERT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }
`;

const STAR_FRAG = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform vec3 uColor;

  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    #include <logdepthbuf_fragment>
    vec3 V = normalize(cameraPosition - vWorldPos);
    float mu = max(dot(normalize(vNormal), V), 0.0);
    // limb darkening: bright core, dimmer redder edge
    float limb = 0.45 + 0.55 * pow(mu, 0.6);
    vec3 col = uColor * (1.35 * limb);
    col = mix(col * vec3(1.0, 0.72, 0.55), col, smoothstep(0.0, 0.45, mu));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function makeGlowTexture(): THREE.CanvasTexture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.05, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,0.55)");
  g.addColorStop(0.25, "rgba(255,255,255,0.18)");
  g.addColorStop(0.6, "rgba(255,255,255,0.05)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function RemoteStar({ def, glow }: { def: BodyDef; glow: THREE.CanvasTexture }) {
  const groupRef = useRef<THREE.Group>(null);
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(def.color) } }),
    [def.color],
  );

  useFrame(() => {
    if (groupRef.current) offsetOf(def.id, groupRef.current.position);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[def.radius, 48, 48]} />
        <shaderMaterial uniforms={uniforms} vertexShader={STAR_VERT} fragmentShader={STAR_FRAG} />
      </mesh>
      <sprite scale={def.radius * 7}>
        <spriteMaterial
          map={glow}
          color={def.color}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <sprite scale={def.radius * 2.6}>
        <spriteMaterial
          map={glow}
          color="#ffffff"
          transparent
          opacity={0.4}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}

export function RemoteStars() {
  const glow = useMemo(() => makeGlowTexture(), []);
  return (
    <>
      {STAR_IDS.map((id) => (
        <RemoteStar key={id} def={BODIES[id]} glow={glow} />
      ))}
    </>
  );
}
