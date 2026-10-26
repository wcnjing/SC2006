# P2 Lab 2 activity filters

Implemented on `p2-Activity`, using the existing upcoming scheduled activity API.
No database changes, geocoding, dependencies or changes to P1/P3/P4/P5.

| Requirement                | Existing data                       | Behaviour                                                                                                                                       |
| -------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| FR 4.2.2 Distance          | `activities.lat`, `activities.lng`  | Within 1/5/10/25 km of the device location, using great-circle distance. Explicit browser permission; never substitutes a neighbourhood centre. |
| FR 4.2.4 Date              | `activities.starts_at`              | Optional inclusive from/to start dates in Singapore time, entered as YYYY-MM-DD. Invalid or reversed ranges show validation feedback.           |
| FR 4.2.5 Accessibility     | `activities.accessibility_features` | Options come from the loaded activities; all selected features must match. Empty arrays do not imply accessibility.                             |
| FR 4.2.6 Indoor/outdoor    | `activities.is_outdoor`             | Any setting, Indoor or Outdoor.                                                                                                                 |
| FR 4.2.7 Immediate updates | Existing client-side filter API     | Every edit immediately recomputes results; all criteria combine with keyword, category and location using AND.                                  |

Clear filters resets every criterion and restores the loaded upcoming activities.
There are separate messages for no upcoming activities, no matching results, invalid dates,
missing accessibility metadata and unavailable/denied device location.
The controls and results share a scrollable list, keeping the expanded form reachable.

## Data and integration limits

- Distance is usable on Expo Web with browser geolocation (normally HTTPS or localhost).
  Location stays in page memory. Users must obtain their location and choose a radius;
  a late location response does not silently activate a distance filter after Clear.
- Activities with missing or invalid coordinates are excluded only when distance is active.
  Complete distance coverage requires organisers/dataset ingestion to supply correct coordinates.
  Addresses are not silently geocoded. No shared data was inspected or changed to fill gaps.
- Profiles contain a neighbourhood ID, not a precise resident/home position. Distance from home,
  walking/driving distance, and native device location would require separate data/integration.
  This implementation explicitly labels its device/straight-line behaviour.
- Accessibility options reflect stored feature strings, without inventing mappings or claims.
  Full coverage requires consistent, accurate feature metadata from organisers/imports.
- Date means the activity's start day, not overlap with any portion of a multi-day activity.

## Preview and checks

Run `npm run web --workspace apps/mobile`, sign in and open Upcoming activities.
Try a date range, accessibility feature and setting alongside existing search/category/location.
For distance, choose Use my current location, grant permission and select a radius.
Clear filters should restore all loaded activities. Denied location access leaves other filters usable.
Use existing records only; no SQL or data modifications are needed.

Automated tests use isolated fixtures and mocked geolocation, including combined criteria,
Singapore midnight boundaries, invalid dates, required accessibility features, missing coordinates,
radius boundaries, device errors, immediate callbacks and clearing all criteria.
Actual browser permission prompts and production metadata coverage still need live verification.
