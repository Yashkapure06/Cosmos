// 1 scene unit = 1 Earth radius
export const EARTH_RADIUS_KM = 6371;
export const KM_TO_UNITS = 1 / EARTH_RADIUS_KM;

// GM of Earth, km^3/s^2 (for apogee/perigee derivation)
export const MU_EARTH = 398600.4418;

export const CELESTRAK_BASE = "https://celestrak.org/NORAD/elements/gp.php";
export const TLE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2h, per CelesTrak guidance

export type Category =
  | "station"
  | "starlink"
  | "oneweb"
  | "navigation"
  | "weather"
  | "other"
  | "debris";

export const CATEGORY_ORDER: Category[] = [
  "station",
  "starlink",
  "oneweb",
  "navigation",
  "weather",
  "other",
  "debris",
];

export const CATEGORY_LABEL: Record<Category, string> = {
  station: "Stations",
  starlink: "Starlink",
  oneweb: "OneWeb",
  navigation: "Navigation",
  weather: "Weather / Earth obs",
  other: "Other active",
  debris: "Debris",
};

export const CATEGORY_COLOR: Record<Category, string> = {
  station: "#ffb000",
  starlink: "#7dd3fc",
  oneweb: "#a78bfa",
  navigation: "#4ade80",
  weather: "#f472b6",
  other: "#9fb0c8",
  debris: "#f87171",
};

// Debris groups fetched lazily when the toggle turns on
export const DEBRIS_GROUPS = [
  "cosmos-1408-debris",
  "fengyun-1c-debris",
  "iridium-33-debris",
  "cosmos-2251-debris",
];
