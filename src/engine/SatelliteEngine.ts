// Owns the propagation worker and the shared position/velocity buffers.
// Lives outside React so the render loop can read buffers with zero overhead.

import * as THREE from "three";
import { gstime, eciToGeodetic, degreesLat, degreesLong } from "satellite.js";
import { EARTH_RADIUS_KM } from "../lib/constants";
import type { FromWorker, LiveSample, OmmRecord, ToWorker } from "../lib/types";

type OrbitResolver = (points: Float32Array) => void;

export class SatelliteEngine {
  private worker: Worker;
  private orbitRequests = new Map<number, OrbitResolver>();
  private nextRequestId = 1;

  /** scene-unit positions at baseSimTime, xyz per sat */
  positions = new Float32Array(0);
  /** scene units per sim second */
  velocities = new Float32Array(0);
  baseSimTime = 0;
  count = 0;
  /** bumped every time buffers are replaced (new tick or catalog growth) */
  version = 0;
  /** 1 = pickable/visible, maintained by the Satellites layer */
  visibleMask: Float32Array | null = null;

  onReady: ((total: number, valid: number) => void) | null = null;
  onAppended: ((total: number, valid: number) => void) | null = null;
  onPositions: (() => void) | null = null;

  private pendingPropagate = false;

  constructor() {
    this.worker = new Worker(
      new URL("../workers/propagator.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const msg = e.data;
      switch (msg.type) {
        case "ready":
          this.count = msg.total;
          this.onReady?.(msg.total, msg.valid);
          break;
        case "appended":
          this.count = msg.total;
          this.onAppended?.(msg.total, msg.valid);
          break;
        case "positions":
          this.positions = msg.positions;
          this.velocities = msg.velocities;
          this.baseSimTime = msg.simTime;
          this.count = msg.positions.length / 3;
          this.version++;
          this.pendingPropagate = false;
          this.onPositions?.();
          break;
        case "orbitResult": {
          const resolve = this.orbitRequests.get(msg.requestId);
          this.orbitRequests.delete(msg.requestId);
          resolve?.(msg.points);
          break;
        }
      }
    };
  }

  private send(msg: ToWorker) {
    this.worker.postMessage(msg);
  }

  init(omms: OmmRecord[]) {
    this.send({ type: "init", omms });
  }

  append(omms: OmmRecord[]) {
    this.send({ type: "append", omms });
  }

  requestPropagate(simTime: number) {
    if (this.pendingPropagate) return;
    this.pendingPropagate = true;
    this.send({ type: "propagate", simTime });
  }

  requestOrbit(index: number, simTime: number, samples = 256): Promise<Float32Array> {
    const requestId = this.nextRequestId++;
    return new Promise((resolve) => {
      this.orbitRequests.set(requestId, resolve);
      this.send({ type: "orbit", requestId, index, simTime, samples });
    });
  }

  /** dt in sim seconds since baseSimTime */
  dtSeconds(simNow: number): number {
    return (simNow - this.baseSimTime) / 1000;
  }

  positionOf(index: number, simNow: number, target: THREE.Vector3): THREE.Vector3 {
    const dt = this.dtSeconds(simNow);
    const j = index * 3;
    return target.set(
      this.positions[j] + this.velocities[j] * dt,
      this.positions[j + 1] + this.velocities[j + 1] * dt,
      this.positions[j + 2] + this.velocities[j + 2] * dt,
    );
  }

  liveSample(index: number, simNow: number): LiveSample | null {
    if (index < 0 || index >= this.count || this.positions.length === 0) return null;
    const dt = this.dtSeconds(simNow);
    const j = index * 3;
    // scene units -> ECI km: scene (x, y, z) -> eci (x, -z, y)
    const sx = (this.positions[j] + this.velocities[j] * dt) * EARTH_RADIUS_KM;
    const sy = (this.positions[j + 1] + this.velocities[j + 1] * dt) * EARTH_RADIUS_KM;
    const sz = (this.positions[j + 2] + this.velocities[j + 2] * dt) * EARTH_RADIUS_KM;
    const eci = { x: sx, y: -sz, z: sy };
    const r = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (r === 0) return null;
    const vx = this.velocities[j] * EARTH_RADIUS_KM;
    const vy = this.velocities[j + 1] * EARTH_RADIUS_KM;
    const vz = this.velocities[j + 2] * EARTH_RADIUS_KM;
    const gmst = gstime(new Date(simNow));
    const geo = eciToGeodetic(eci, gmst);
    return {
      altitudeKm: geo.height,
      speedKmS: Math.sqrt(vx * vx + vy * vy + vz * vz),
      latitudeDeg: degreesLat(geo.latitude),
      longitudeDeg: degreesLong(geo.longitude),
    };
  }

  /**
   * Nearest satellite to pointer, in screen space. O(n) projection, click-time only.
   * visibleMask: 1 = pickable. Returns index or -1.
   */
  pick(
    camera: THREE.Camera,
    ndcX: number,
    ndcY: number,
    simNow: number,
    visibleMask: Float32Array | null,
    thresholdPx: number,
    viewportW: number,
    viewportH: number,
    frameOffset?: THREE.Vector3,
  ): number {
    const dt = this.dtSeconds(simNow);
    const v = new THREE.Vector3();
    let best = -1;
    let bestDist = Infinity;
    const px = ((ndcX + 1) / 2) * viewportW;
    const py = ((1 - ndcY) / 2) * viewportH;
    const ox = frameOffset?.x ?? 0;
    const oy = frameOffset?.y ?? 0;
    const oz = frameOffset?.z ?? 0;
    for (let i = 0; i < this.count; i++) {
      if (visibleMask && visibleMask[i] === 0) continue;
      const j = i * 3;
      const x = this.positions[j] + this.velocities[j] * dt;
      const y = this.positions[j + 1] + this.velocities[j + 1] * dt;
      const z = this.positions[j + 2] + this.velocities[j + 2] * dt;
      if (x === 0 && y === 0 && z === 0) continue;
      v.set(x + ox, y + oy, z + oz).project(camera);
      if (v.z > 1) continue; // behind camera
      const sx = ((v.x + 1) / 2) * viewportW;
      const sy = ((1 - v.y) / 2) * viewportH;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return bestDist <= thresholdPx ? best : -1;
  }

  dispose() {
    this.worker.terminate();
  }
}

export const engine = new SatelliteEngine();
