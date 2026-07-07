export function fmtKm(v: number): string {
  return `${Math.round(v).toLocaleString("en-US")} km`;
}

export function fmtSpeed(v: number): string {
  return `${v.toFixed(2)} km/s`;
}

export function fmtDeg(v: number): string {
  return `${v.toFixed(2)}°`;
}

export function fmtPeriod(min: number): string {
  if (min < 120) return `${min.toFixed(1)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function fmtLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
}

export function fmtUtc(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(
    d.getUTCHours(),
  )}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`;
}
