import { create } from "zustand";
import { CATEGORY_ORDER, type Category } from "../lib/constants";
import type { BodyId } from "../lib/bodies";
import type { SatMeta } from "../lib/types";
import type { QualityTier } from "../lib/quality";
import { playCue } from "../lib/audio";

export type LoadStage = "idle" | "fetching" | "initializing" | "ready" | "error";

interface TimeState {
  anchorReal: number;
  anchorSim: number;
  speed: number;
}

interface OrbitStore {
  // catalog
  stage: LoadStage;
  error: string | null;
  meta: SatMeta[];
  activeCount: number;
  debrisLoaded: boolean;
  debrisLoading: boolean;
  /** bumped when the catalog grows so scene buffers rebuild */
  catalogVersion: number;

  // filters
  enabled: Record<Category, boolean>;

  // selection
  selectedIndex: number;
  follow: boolean;

  // focus frame (solar-system phase 1)
  focus: BodyId;

  // deep-space craft loaded (phase 3)
  spacecraftReady: boolean;

  // keyboard fly mode (arrow keys / WASD)
  flyMode: boolean;

  // body name labels (markers) visibility
  showLabels: boolean;

  // constellation figures + zodiac + ecliptic visibility
  showConstellations: boolean;

  // sat ground track + footprint
  showGroundTrack: boolean;

  // sat density heatmap + Starlink mesh
  showHeatmap: boolean;
  showSatLinks: boolean;

  // true-scale body compare overlay
  compareMode: boolean;

  // procedural space audio
  audioMuted: boolean;

  // adaptive quality (mirrored from monitor for HUD)
  qualityTier: QualityTier;

  // time machine
  time: TimeState;

  setStage: (stage: LoadStage, error?: string) => void;
  setMeta: (meta: SatMeta[]) => void;
  appendMeta: (meta: SatMeta[]) => void;
  setDebrisLoading: (v: boolean) => void;
  toggleCategory: (c: Category) => void;
  select: (index: number) => void;
  clearSelection: () => void;
  setFollow: (v: boolean) => void;
  setFocus: (b: BodyId) => void;
  setSpacecraftReady: () => void;
  toggleFlyMode: () => void;
  toggleLabels: () => void;
  toggleConstellations: () => void;
  toggleGroundTrack: () => void;
  toggleHeatmap: () => void;
  toggleSatLinks: () => void;
  toggleCompareMode: () => void;
  toggleAudioMuted: () => void;
  setQualityTier: (tier: QualityTier) => void;
  setSpeed: (speed: number) => void;
  jumpBy: (deltaMs: number) => void;
  goLive: () => void;
}

export const simNow = (t: TimeState): number =>
  t.anchorSim + (Date.now() - t.anchorReal) * t.speed;

export const useStore = create<OrbitStore>((set, get) => ({
  stage: "idle",
  error: null,
  meta: [],
  activeCount: 0,
  debrisLoaded: false,
  debrisLoading: false,
  catalogVersion: 0,

  enabled: Object.fromEntries(
    CATEGORY_ORDER.map((c) => [c, c !== "debris"]),
  ) as Record<Category, boolean>,

  selectedIndex: -1,
  follow: false,

  focus: "earth",

  spacecraftReady: false,

  flyMode: false,

  showLabels: true,

  showConstellations: true,

  showGroundTrack: true,

  showHeatmap: false,

  showSatLinks: false,

  compareMode: false,

  audioMuted: true,

  qualityTier: "high",

  time: { anchorReal: Date.now(), anchorSim: Date.now(), speed: 1 },

  setStage: (stage, error) => set({ stage, error: error ?? null }),
  setMeta: (meta) =>
    set((s) => ({
      meta,
      activeCount: meta.length,
      catalogVersion: s.catalogVersion + 1,
    })),
  appendMeta: (extra) =>
    set((s) => ({
      meta: [...s.meta, ...extra],
      debrisLoaded: true,
      debrisLoading: false,
      catalogVersion: s.catalogVersion + 1,
    })),
  setDebrisLoading: (v) => set({ debrisLoading: v }),

  toggleCategory: (c) =>
    set((s) => ({ enabled: { ...s.enabled, [c]: !s.enabled[c] } })),

  select: (index) => set({ selectedIndex: index }),
  clearSelection: () => set({ selectedIndex: -1, follow: false }),
  setFollow: (v) => set({ follow: v }),
  setFocus: (b) => {
    if (get().focus !== b) playCue("focus");
    set({ focus: b, follow: false });
  },
  setSpacecraftReady: () => set({ spacecraftReady: true }),
  toggleFlyMode: () => {
    playCue("fly");
    set((s) => ({ flyMode: !s.flyMode }));
  },
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleConstellations: () =>
    set((s) => ({ showConstellations: !s.showConstellations })),
  toggleGroundTrack: () =>
    set((s) => ({ showGroundTrack: !s.showGroundTrack })),
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  toggleSatLinks: () => set((s) => ({ showSatLinks: !s.showSatLinks })),
  toggleCompareMode: () => set((s) => ({ compareMode: !s.compareMode })),
  toggleAudioMuted: () => set((s) => ({ audioMuted: !s.audioMuted })),
  setQualityTier: (tier) => set({ qualityTier: tier }),

  setSpeed: (speed) => {
    const t = get().time;
    set({ time: { anchorReal: Date.now(), anchorSim: simNow(t), speed } });
  },
  jumpBy: (deltaMs) => {
    const t = get().time;
    set({
      time: {
        anchorReal: Date.now(),
        anchorSim: simNow(t) + deltaMs,
        speed: t.speed,
      },
    });
  },
  goLive: () =>
    set({ time: { anchorReal: Date.now(), anchorSim: Date.now(), speed: 1 } }),
}));

/** Read current sim time without subscribing (for render loops). */
export const getSimNow = (): number => simNow(useStore.getState().time);

export const isLive = (t: TimeState): boolean =>
  t.speed === 1 && Math.abs(simNow(t) - Date.now()) < 2000;
