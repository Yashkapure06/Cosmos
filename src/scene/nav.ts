// Navigation singleton: lets DOM UI (marker labels) trigger the same
// cinematic fly-to that double-clicking a body uses. ScrollNavigator wires
// the real implementation once camera + controls exist.

import type { BodyId } from "../lib/bodies";

export const nav = {
  flyTo: (_id: BodyId) => {},
};
