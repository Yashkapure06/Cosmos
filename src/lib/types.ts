import type { Category } from "./constants";

// Subset of CelesTrak OMM JSON we care about (json2satrec consumes the raw object)
export interface OmmRecord {
  [key: string]: unknown;
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE?: 0 | "0";
  CLASSIFICATION_TYPE?: "U" | "C";
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

export interface SatMeta {
  index: number;
  name: string;
  noradId: number;
  intlDes: string;
  category: Category;
  /** degrees */
  inclination: number;
  /** minutes */
  periodMin: number;
  apogeeKm: number;
  perigeeKm: number;
  epoch: string;
  launchYear: number | null;
}

export interface LiveSample {
  /** km above surface */
  altitudeKm: number;
  /** km/s */
  speedKmS: number;
  latitudeDeg: number;
  longitudeDeg: number;
}

// ---- worker protocol ----

export interface InitMsg {
  type: "init";
  omms: OmmRecord[];
}
export interface AppendMsg {
  type: "append";
  omms: OmmRecord[];
}
export interface PropagateMsg {
  type: "propagate";
  simTime: number;
}
export interface OrbitMsg {
  type: "orbit";
  requestId: number;
  index: number;
  simTime: number;
  samples: number;
}
export type ToWorker = InitMsg | AppendMsg | PropagateMsg | OrbitMsg;

export interface ReadyMsg {
  type: "ready";
  total: number;
  valid: number;
}
export interface AppendedMsg {
  type: "appended";
  total: number;
  valid: number;
}
export interface PositionsMsg {
  type: "positions";
  simTime: number;
  /** scene units, xyz per satellite */
  positions: Float32Array;
  /** scene units per sim second */
  velocities: Float32Array;
}
export interface OrbitResultMsg {
  type: "orbitResult";
  requestId: number;
  index: number;
  /** scene units, closed loop over one period */
  points: Float32Array;
}
export type FromWorker = ReadyMsg | AppendedMsg | PositionsMsg | OrbitResultMsg;
