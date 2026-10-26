# P2 personalised activity recommendations

## Implemented contract

FR 5.1.1–5.1.6 / UC #5-03: active residents open **Recommended for you** on the activity listing, or `/activities/recommendations`. Cards link to the existing details with independent Save/Unsave and Join/Leave. This implementation follows the supplied behaviours; the full submitted Lab 2 text and mockups are not in this checkout, so compliance with any additional unpublished wording remains a team review item.

No schema changes, migrations, database mutations, notifications or new dependencies. Existing profile interests/accessibility_needs/neighbourhood_id, neighbourhood coordinates, activity category/tags/is_outdoor/accessibility_features/coordinates/start/status/capacity, and RLS-visible joined registrations are used. Profiles are derived from the authenticated user, restricted to active residents. Existing RLS permits reads of joined participant rows; no permissions are broadened. Save/Join, filters, ratings and organiser workflows are unchanged.

## Explainable ranking

Only scheduled activities starting strictly in the future, with spare specified capacity, not already joined by this resident, and matching **every** accessibility need are eligible. Bookmarks do not affect eligibility. Join still rechecks eligibility atomically through the existing RPC; a recommendation is only a read snapshot and cannot reserve capacity.

Preference strings are trimmed, case folded and whitespace/underscore/hyphen normalised. Interest matches use exact normalised category/tag values plus `outdoors` for outdoor activities; no inferred semantic synonyms. Accessibility uses exact normalised features and is a hard constraint, never traded for popularity. Missing accessibility metadata excludes activities when requirements cannot be confirmed.

With interests: interest score = 60 × matched unique interests / total unique interests; proximity = 25 / (1 + straight-line km / 5); popularity = 15 × joined registrations / (joined registrations + 5). Without interests: proximity weight 60, popularity weight 40, interest weight 0. Scores sum to at most 100. Ties sort by earlier start, then activity ID. The top 20 are shown with the contributing reasons and total score.

Default proximity uses the profile neighbourhood centre, explicitly labelled approximate, not a home address. Optional browser location improves precision and stays in client memory; it is not saved or submitted to Supabase. Missing/invalid coordinates receive zero proximity score and an explicit explanation. With neither interests nor position, ranking uses popularity and chronological ties. Missing accessibility preferences impose no accessibility restriction.

## Performance and failure handling

Ranking is deterministic local computation. Queries reuse paginated activity reads and fetch joined rows in chunks of 100 activity IDs with at most four chunks concurrent, paging until empty to accommodate lower PostgREST row limits. Only eligible upcoming activity IDs are queried. Failed reads produce an error rather than misleading partial counts. Auth/profile/read failures and a three-second deadline have explicit retry feedback; abortable activity/participant queries are cancelled at deadline. Existing profile/neighbourhood reads are not abortable, but late responses cannot start subsequent queries. Refresh and reopening regenerate from current persisted preferences and participant states.

The automated benchmark measures ranking 10,000 mock activities with real timers, excluding network. A separate fake-timer test verifies the three-second API deadline and suppresses late query fanout. **A timeout is not a successful recommendation generation**: the NFR still requires live end-to-end timing on representative network/data volume. Pagination and RLS transfer costs can exceed the budget; no successful-network guarantee or live verification is claimed. A future team-reviewed aggregate read API may be needed at scale.

## Verification

Automated tests cover scoring/reasons, fallback, multiple accessibility requirements, past/cancelled/completed/full/own-joined exclusion, invalid coordinates, deterministic ties, auth/role/status/profile mismatch, paginated counts, bounded queries, read failures, timeout, local ranking performance, resident navigation, UI loading/errors/empty results and existing details links. All tests use fixtures/mocks; no live data is changed.

For live verification, log in as an existing active resident, open the recommendation link, inspect reasons, optionally allow device location, and open a card's details. Confirm profile vocabulary aligns with actual category/tag/accessibility metadata and verify real end-to-end generation within three seconds. Check approximate neighbourhood origin against the resident's intended location. Live timing, geolocation permission UX, actual data completeness and full submitted Lab 2 wording remain review items. Existing Save/Join basic live testing need not be repeated merely for this read-only list.

Validation for this change: 311 automated tests passed (106 app, 205 shared), TypeScript checks passed, Expo Web export passed, and changed UI files passed ESLint. The local 10,000-activity ranking benchmark took approximately 84 ms in this environment; this excludes network. Full Expo lint still fails on two pre-existing P1 `InactivityGuard.tsx` rules (render-time Date.now and recursive schedule declaration); no P1 code was modified.
