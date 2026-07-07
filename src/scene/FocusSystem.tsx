// FrameDriver: refreshes ephemerides and the focus-frame singleton once per
// frame (must be the first child of the Canvas).
// ScrollNavigator: scroll-magnet navigation across the whole solar system -
// aim at any body (cursor on it, or near screen center) and wheel-in pulls
// you there; double-click flies there; focus hands off silently by proximity
// with a parent-chain release (moon -> planet -> sun), hysteresis, no flap.

import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import gsap from "gsap";
import { getSimNow, useStore } from "../store/useStore";
import {
  BODIES,
  BODY_IDS,
  handoffIn,
  releaseRadius,
  viewDistance,
  type BodyId,
} from "../lib/bodies";
import { spacecraftReady } from "../lib/spacecraft";
import { frames, helio, offsetOf } from "./frames";
import { nav } from "./nav";

export function FrameDriver() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__orbit = {
      camera,
      controls,
      scene,
      frames,
      helio,
      store: useStore,
    };
    // dev navigation bridge (also reachable from extension isolated worlds)
    const goto = (e: Event) => {
      // detail doesn't cross extension worlds; body dataset does
      const id = ((e as CustomEvent<string>).detail ??
        document.body.dataset.orbitGoto) as BodyId;
      if (!BODIES[id]) return;
      const c = controls as OrbitControlsImpl | null;
      if (!c) return;
      gsap.killTweensOf([camera.position, c.target]);
      const pos = offsetOf(id, new THREE.Vector3());
      const d = Math.max(viewDistance(id), BODIES[id].radius * 3);
      c.target.copy(pos);
      camera.position.copy(pos).add(new THREE.Vector3(d * 0.8, d * 0.35, d * 0.75));
      c.update();
    };
    window.addEventListener("orbit:goto", goto);
    return () => window.removeEventListener("orbit:goto", goto);
  }, [camera, controls, scene]);

  useFrame(() => {
    const focus = useStore.getState().focus;
    frames.focus = focus;
    helio.refresh(getSimNow(), focus);
    frames.moonVec.copy(helio.pos.moon).sub(helio.pos.earth);
    offsetOf("earth", frames.earthOffset);
    frames.cameraDist = camera.position.length();
  });
  return null;
}

/** Group holding everything geocentric (Earth, satellites, Moon, orbits). */
export function EarthFrame({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    ref.current?.position.copy(frames.earthOffset);
  });
  return <group ref={ref}>{children}</group>;
}

/** cursor must be within body's angular radius + this margin (rad) */
const CURSOR_MARGIN = 0.035;
/** screen-center rule: body within this cone of the view axis (rad) */
const CENTER_CONE = 0.1;
/** how strongly each wheel-in steers the orbit target toward the cursor */
const STEER_LERP = 0.12;
/** skip the "ease target home" pull for this long after any user input (ms) */
const INTERACT_GRACE_MS = 3000;

interface Aim {
  id: BodyId;
  pos: THREE.Vector3;
}

export function ScrollNavigator() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const ndc = useRef({ x: 0, y: 0 });
  const lastInteract = useRef(-Infinity);
  const scratch = useRef({
    ray: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    delta: new THREE.Vector3(),
    steer: new THREE.Vector3(),
  });

  // active fly-to. Everything is stored RELATIVE to the destination body, so
  // mid-flight focus rebases (which shift camera, target and dest equally)
  // cancel out - the old absolute-endpoint tween flew through planets.
  // Distance is interpolated in LOG space: apparent size then grows steadily
  // on screen for the whole flight instead of exploding in the last second.
  const flight = useRef<{
    id: BodyId;
    elapsed: number;
    duration: number;
    dir: THREE.Vector3;
    logD0: number;
    logD1: number;
    targetStartRel: THREE.Vector3;
  } | null>(null);

  const findAim = (useCursor: boolean): Aim | null => {
    const s = scratch.current;
    if (useCursor) {
      s.ray
        .set(ndc.current.x, ndc.current.y, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize();
    } else {
      camera.getWorldDirection(s.ray);
    }
    const margin = useCursor ? CURSOR_MARGIN : CENTER_CONE;

    let best: Aim | null = null;
    let bestScore = Infinity;
    const craftOk = spacecraftReady();
    for (const id of BODY_IDS) {
      if (BODIES[id].type === "craft" && !craftOk) continue; // ghosts at origin
      const pos = offsetOf(id, s.pos);
      s.dir.copy(pos).sub(camera.position);
      const dist = s.dir.length();
      if (dist < 0.001) continue;
      s.dir.normalize();
      const angRadius = Math.asin(Math.min(1, BODIES[id].radius / dist));
      const angle = s.ray.angleTo(s.dir);
      if (angle > angRadius + margin) continue;
      // prefer the closest body when cones overlap (moon in front of planet)
      const score = angle - angRadius + dist * 1e-9;
      if (score < bestScore) {
        bestScore = score;
        best = { id, pos: pos.clone() };
      }
    }
    return best;
  };

  useEffect(() => {
    const el = gl.domElement;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      ndc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const aim = findAim(true);
      el.style.cursor =
        aim && aim.id !== useStore.getState().focus ? "pointer" : "";
    };

    // Free zoom-toward-cursor: each wheel-in gently steers the orbit target
    // toward wherever the cursor points, so the camera flies where you look
    // instead of being magnet-locked to the nearest planet. OrbitControls
    // still does the actual dolly; we only nudge the target.
    const onWheel = (e: WheelEvent) => {
      flight.current = null; // user takes over
      lastInteract.current = performance.now();
      if (e.deltaY >= 0) return; // only steer on zoom-in; zoom-out stays put
      const c = controlsRef.current;
      if (!c) return;
      const s = scratch.current;
      s.ray
        .set(ndc.current.x, ndc.current.y, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      const dist = camera.position.distanceTo(c.target);
      s.steer.copy(camera.position).addScaledVector(s.ray, dist);
      c.target.lerp(s.steer, STEER_LERP);
    };

    // cinematic flight to a body; proximity handoff finishes it on arrival
    const flyTo = (id: BodyId) => {
      const c = controlsRef.current;
      if (!c) return;
      const pos = offsetOf(id, new THREE.Vector3());
      const startRel = camera.position.clone().sub(pos);
      const d0 = startRel.length();
      const d1 = viewDistance(id);
      if (d0 < 0.001 || Math.abs(d0 - d1) < 0.01) return;
      gsap.killTweensOf([camera.position, c.target]);
      // duration scales with how many orders of magnitude we cross
      const octaves = Math.abs(Math.log(d0 / d1));
      flight.current = {
        id,
        elapsed: 0,
        duration: THREE.MathUtils.clamp(1.1 + octaves * 0.42, 1.6, 6.0),
        dir: startRel.normalize(), // approach along current line of sight
        logD0: Math.log(d0),
        logD1: Math.log(d1),
        targetStartRel: c.target.clone().sub(pos),
      };
    };
    nav.flyTo = flyTo;

    // user input takes control back immediately
    const cancelFlight = () => {
      flight.current = null;
      lastInteract.current = performance.now();
    };
    el.addEventListener("pointerdown", cancelFlight);

    // double-click a body in the 3D view -> same flight
    const onDblClick = () => {
      const aim = findAim(true);
      if (aim) flyTo(aim.id);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("dblclick", onDblClick);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDblClick);
      el.removeEventListener("pointerdown", cancelFlight);
      el.style.cursor = "";
      nav.flyTo = () => {};
      flight.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera]);

  // flight execution + silent focus handoff by proximity
  useFrame((_, delta) => {
    const c = controlsRef.current;
    if (!c) return;
    const s = scratch.current;
    const { focus, setFocus } = useStore.getState();

    // rebase-immune flight: recomputed from the destination's CURRENT
    // focus-frame position every frame, so handoff rebases cancel out.
    // Log-space distance = constant perceptual approach speed.
    const f = flight.current;
    if (f) {
      f.elapsed += delta;
      const a = THREE.MathUtils.smoothstep(
        Math.min(f.elapsed / f.duration, 1),
        0,
        1,
      );
      const dest = offsetOf(f.id, s.pos);
      const d = Math.exp(THREE.MathUtils.lerp(f.logD0, f.logD1, a));
      camera.position.copy(dest).addScaledVector(f.dir, d);
      s.dir.copy(f.targetStartRel).multiplyScalar(1 - a);
      c.target.copy(dest).add(s.dir);
      if (f.elapsed >= f.duration) flight.current = null;
    }

    // capture: nearest non-focus body whose handoff sphere we entered
    let bestId: BodyId | null = null;
    let bestDist = Infinity;
    const craftOk = spacecraftReady();
    for (const id of BODY_IDS) {
      if (id === focus) continue;
      if (BODIES[id].type === "craft" && !craftOk) continue;
      const pos = offsetOf(id, s.pos);
      const d = camera.position.distanceTo(pos);
      if (d < handoffIn(id) && d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }

    let next: BodyId | null = bestId;
    if (!next) {
      // release: left the focus body's sphere of interest -> climb to parent
      const dist = camera.position.length();
      if (dist > releaseRadius(focus) && BODIES[focus].parent) {
        next = BODIES[focus].parent;
      }
    }

    if (next && next !== focus) {
      // atomic rebase: world shifts by -delta, camera shifts with it
      offsetOf(next, s.delta);
      camera.position.sub(s.delta);
      c.target.sub(s.delta);
      setFocus(next);
      return;
    }

    // drifted target far from the focus body while zoomed way out: ease home,
    // but ONLY when the user hasn't touched the controls recently -- otherwise
    // this pull fights free panning/steering and yanks them back to the body.
    if (
      !flight.current &&
      performance.now() - lastInteract.current > INTERACT_GRACE_MS &&
      c.target.lengthSq() > 0.01 &&
      frames.cameraDist > releaseRadius(focus) * 0.8
    ) {
      c.target.lerp(s.pos.set(0, 0, 0), 0.02);
    }
  });

  return null;
}
