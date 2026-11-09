export type LatLng = { lat: number; lng: number };

/**
 * Straight-line (great-circle) distance in km. Same formula as P2's
 * `activityDistanceKm`, so the numbers on screen match the ranking.
 * Plan "simple distance first": no OneMap call needed.
 */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function hasCoordinates(p: { lat: number | null; lng: number | null }): p is LatLng {
  return (
    p.lat !== null &&
    p.lng !== null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}
