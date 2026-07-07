// Loads the catalog, feeds the worker, and keeps propagation fresh
// against the (possibly time-warped) simulation clock.

import { useEffect } from "react";
import { engine } from "../engine/SatelliteEngine";
import { buildMeta, fetchActiveCatalog, fetchDebrisCatalog } from "../lib/celestrak";
import { loadSpacecraft, spacecraftReady } from "../lib/spacecraft";
import { getSimNow, useStore } from "../store/useStore";

/** re-propagate when the GPU extrapolation is older than this (sim time) */
const MAX_EXTRAPOLATION_MS = 30_000;

export function useBootstrap() {
  useEffect(() => {
    let disposed = false;
    const { setStage, setMeta } = useStore.getState();

    // deep-space craft load independently of the satellite catalog
    void loadSpacecraft().then(() => {
      if (!disposed && spacecraftReady())
        useStore.getState().setSpacecraftReady();
    });

    (async () => {
      try {
        setStage("fetching");
        const omms = await fetchActiveCatalog();
        if (disposed) return;
        setStage("initializing");
        setMeta(buildMeta(omms, 0));
        engine.onReady = () => {
          engine.requestPropagate(getSimNow());
          useStore.getState().setStage("ready");
        };
        engine.init(omms);
      } catch (err) {
        setStage("error", err instanceof Error ? err.message : String(err));
      }
    })();

    const interval = setInterval(() => {
      if (useStore.getState().stage !== "ready") return;
      const simNow = getSimNow();
      if (Math.abs(simNow - engine.baseSimTime) > MAX_EXTRAPOLATION_MS) {
        engine.requestPropagate(simNow);
      }
    }, 200);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, []);
}

export async function loadDebris() {
  const store = useStore.getState();
  if (store.debrisLoaded || store.debrisLoading) return;
  store.setDebrisLoading(true);
  try {
    const omms = await fetchDebrisCatalog();
    const startIndex = useStore.getState().meta.length;
    engine.onAppended = () => {
      useStore.getState().appendMeta(buildMeta(omms, startIndex, "debris"));
      engine.requestPropagate(getSimNow());
    };
    engine.append(omms);
  } catch {
    useStore.getState().setDebrisLoading(false);
  }
}
