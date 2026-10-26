import { describe, expect, it } from 'vitest';
import {
  activityDistanceKm,
  activityFilterError,
  filterActivities,
  validCoordinates,
} from '../src/api/activities';

const activity = {
  title: 'Walk',
  description: 'Together',
  tags: ['fitness'],
  category: 'Exercise',
  location_name: 'Park',
  address: null,
  starts_at: '2026-12-01T16:00:00Z',
  accessibility_features: ['wheelchair-access', 'low-intensity'],
  is_outdoor: true,
  lat: 1.3,
  lng: 103.8,
};

describe('Lab 2 activity filters', () => {
  it('combines all seven filters with AND and preserves ordering', () => {
    const rows = [
      activity,
      { ...activity, title: 'Art', is_outdoor: false },
      { ...activity, lat: 2 },
    ];
    expect(
      filterActivities(rows, {
        keyword: 'walk',
        category: 'exercise',
        location: 'park',
        dateFrom: '2026-12-02',
        dateTo: '2026-12-02',
        accessibility: [' WHEELCHAIR-ACCESS ', 'low-intensity'],
        environment: 'outdoor',
        distance: { origin: { lat: 1.3, lng: 103.8 }, maxKm: 5 },
      }),
    ).toEqual([activity]);
    expect(filterActivities(rows, {})).toEqual(rows);
  });

  it('uses inclusive Singapore dates across UTC midnight, independently of host timezone', () => {
    const rows = [
      { ...activity, starts_at: '2026-12-01T15:59:59Z' },
      activity,
      { ...activity, starts_at: '2026-12-02T15:59:59Z' },
      { ...activity, starts_at: '2026-12-02T16:00:00Z' },
    ];
    expect(filterActivities(rows, { dateFrom: '2026-12-02', dateTo: '2026-12-02' })).toEqual(
      rows.slice(1, 3),
    );
    expect(filterActivities(rows, { dateFrom: '2026-12-03' })).toEqual([rows[3]]);
    expect(filterActivities(rows, { dateTo: '2026-12-01' })).toEqual([rows[0]]);
    expect(
      filterActivities([{ ...activity, starts_at: 'invalid' }], { dateFrom: '2026-12-01' }),
    ).toEqual([]);
  });

  it.each(['2026-02-30', '2026-13-01', '2026-2-01', 'abc'])(
    'rejects invalid date %s without silently ignoring it',
    (dateFrom) => {
      expect(activityFilterError({ dateFrom })).toBe('Enter valid dates as YYYY-MM-DD.');
      expect(filterActivities([activity], { dateFrom })).toEqual([]);
    },
  );
  it('rejects reversed dates and accepts leap-day dates', () => {
    expect(activityFilterError({ dateFrom: '2026-12-03', dateTo: '2026-12-01' })).toContain(
      'on or before',
    );
    expect(activityFilterError({ dateFrom: '2028-02-29' })).toBeNull();
  });

  it('requires every accessibility feature without treating missing data as accessible', () => {
    const empty = { ...activity, accessibility_features: [] };
    expect(
      filterActivities([activity, empty], {
        accessibility: ['wheelchair-access', 'hearing-support'],
      }),
    ).toEqual([]);
    expect(filterActivities([activity, empty], { accessibility: ['wheelchair-access'] })).toEqual([
      activity,
    ]);
    expect(filterActivities([activity, empty], { accessibility: [] })).toEqual([activity, empty]);
  });
  it('selects indoor and outdoor independently', () => {
    const indoor = { ...activity, is_outdoor: false };
    expect(filterActivities([activity, indoor], { environment: 'indoor' })).toEqual([indoor]);
    expect(filterActivities([activity, indoor], { environment: 'outdoor' })).toEqual([activity]);
  });
  it('calculates actual great-circle distance, including coincident and antipodal points', () => {
    expect(activityDistanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.195, 2);
    expect(activityDistanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
    expect(activityDistanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(20015.087, 2);
  });
  it('includes the radius boundary and excludes missing/invalid coordinates only when distance is active', () => {
    const rows = [
      activity,
      { ...activity, lat: null },
      { ...activity, lng: 181 },
      { ...activity, lat: NaN },
    ];
    const origin = { lat: 1.4, lng: 103.8 };
    const maxKm = activityDistanceKm(origin, { lat: activity.lat, lng: activity.lng });
    expect(filterActivities(rows, { distance: { origin, maxKm } })).toEqual([activity]);
    expect(filterActivities(rows, { distance: { origin, maxKm: maxKm - 0.001 } })).toEqual([]);
    expect(filterActivities(rows, {})).toEqual(rows);
    expect(validCoordinates({ lat: 0, lng: 0 })).toBe(true);
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid radius %s', (maxKm) => {
    expect(activityFilterError({ distance: { origin: { lat: 0, lng: 0 }, maxKm } })).toBeTruthy();
  });
  it('rejects an invalid origin', () => {
    expect(
      filterActivities([activity], { distance: { origin: { lat: 91, lng: 0 }, maxKm: 5 } }),
    ).toEqual([]);
  });
});
