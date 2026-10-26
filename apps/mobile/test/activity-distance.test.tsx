import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestActivityLocation } from '../src/activities/ActivityDistanceFilter';

afterEach(() => vi.unstubAllGlobals());
function browser(getCurrentPosition: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
}
describe('Web distance origin', () => {
  it('uses device coordinates with a bounded timeout', async () => {
    const get = vi.fn((success) => success({ coords: { latitude: 1.3, longitude: 103.8 } }));
    browser(get);
    expect(await requestActivityLocation()).toEqual({ lat: 1.3, lng: 103.8 });
    expect(get).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      timeout: 10000,
      maximumAge: 60000,
    });
  });
  it('reports missing browser location support', async () => {
    vi.stubGlobal('navigator', {});
    await expect(requestActivityLocation()).rejects.toThrow('unavailable');
  });
  it.each([1, 2, 3])('reports permission/unavailable/timeout errors (%s)', (code) => {
    browser(vi.fn((_success, failure) => failure({ code })));
    return expect(requestActivityLocation()).rejects.toThrow(
      code === 1 ? 'permission denied' : 'Unable to get',
    );
  });
  it('rejects invalid device coordinates', async () => {
    browser(vi.fn((success) => success({ coords: { latitude: NaN, longitude: 103.8 } })));
    await expect(requestActivityLocation()).rejects.toThrow('invalid location');
  });
});
