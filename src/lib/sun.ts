// Low-precision solar position (Astronomical Almanac), good to ~0.01°.
// Returns a unit vector in scene coordinates (ECI with Z-up mapped to Y-up).

export function sunDirectionScene(timeMs: number): [number, number, number] {
  const jd = timeMs / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  const deg = Math.PI / 180;

  const L = (280.46 + 0.9856474 * d) % 360;
  const g = ((357.528 + 0.9856003 * d) % 360) * deg;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * deg;
  const epsilon = (23.439 - 0.0000004 * d) * deg;

  // ECI (equatorial, Z = north pole)
  const x = Math.cos(lambda);
  const y = Math.cos(epsilon) * Math.sin(lambda);
  const z = Math.sin(epsilon) * Math.sin(lambda);

  // ECI (x, y, z) -> scene (x, z, -y): -90° rotation about X, Y-up
  return [x, z, -y];
}
