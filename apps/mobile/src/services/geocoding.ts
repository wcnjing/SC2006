import { ServiceError } from './types';

type GeocodeResult = {
  results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
  status?: string;
};

type OneMapResult = {
  results?: { LATITUDE?: string; LONGITUDE?: string }[];
};

async function geocodeWithOneMap(address: string): Promise<{ lat: number; lng: number } | null> {
  const response = await fetch(
    `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(address)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`,
  );
  if (!response.ok) return null;
  const result = (await response.json()) as OneMapResult;
  const location = result.results?.[0];
  const lat = Number(location?.LATITUDE);
  const lng = Number(location?.LONGITUDE);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number }> {
  try {
    const oneMapLocation = await geocodeWithOneMap(address);
    if (oneMapLocation) return oneMapLocation;
  } catch {
    // Fall through to Google for temporary OneMap failures.
  }

  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new ServiceError('GEOCODING_FAILED');

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${address}, Singapore`)}&key=${encodeURIComponent(key)}`,
  );
  if (!response.ok) throw new ServiceError('GEOCODING_FAILED');
  const result = (await response.json()) as GeocodeResult;
  const location = result.results?.[0]?.geometry?.location;
  if (
    result.status !== 'OK' ||
    location?.lat === undefined ||
    location.lng === undefined ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng)
  ) {
    throw new ServiceError('GEOCODING_FAILED');
  }
  return { lat: location.lat, lng: location.lng };
}
