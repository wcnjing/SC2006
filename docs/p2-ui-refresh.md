# P2 activity UI refresh

Reference: uploaded **SC2006 Lab 2 (1).pdf**, §4.B–4.C, pages 53–54. Inspected the actual mockup images before implementation. The PDF and Plan/ZIP are reference material; this change follows the user's UI request and does not implement other workflows described there.

The listing, details and recommendations reuse P2-only white rounded cards, dark headings, pastel category badges, muted teal activity controls and outlined filter buttons. No dependencies were added. Typography uses the existing system sans-serif font; the PDF does not identify an installable font family.

## Details

- Outlined/filled bookmark represents unsaved/saved. Accessible Save/Unsave labels and pressed state are available on web; native accessibility state is retained. Controls have 44px touch targets and disabled/loading feedback.
- A single top-right refresh reloads details. During that reload, participation/review panels unmount and then remount with their existing focus queries: bookmarks, registration/count, reviews and rating eligibility are fetched again. It is disabled while a resident action or participation read is pending. The standalone review panel retains its refresh control for other consumers.
- Join/Leave remains one prominent button driven by persisted registration state, independent of bookmark state. Existing resident guards, duplicate-action guards, server error messages, cancellation/past/full restrictions and RPCs are unchanged.
- Details are grouped into description, when/where, activity information, and ratings/reviews. Internal Saved/Joined yes/no labels are removed.

## Recommendations

Numerical recommendation scores are not rendered. Only supported interest/accessibility reasons, available distance and actual participant counts appear. Technical fallback reasons are hidden. Device location, neighbourhood fallback and the shared ranking API/algorithm are unchanged. The P2 route has a friendly navigation title.

## Practical mockup differences

- No activity photographs: the existing activity schema does not supply an activity image field; no invented imagery/schema is introduced.
- Shared shell, authentication greeting/logout and five-tab navigation are untouched. The current P1 shell still displays its existing role/onboarding text outside the P2 listing. P5's swipe interface is untouched.
- Existing immediate filters are retained instead of the mockup's Apply Filter workflow, as required by the already implemented P2 requirements.
- Your requested bookmark and combined refresh icons replace the mockup's separate Save text button.

## Preview and verification

From the repository root: `npm run web --workspace apps/mobile`, then use the printed localhost URL. Sign in with an existing account, open an activity from the home listing, and open **Recommended for you** as an active resident.

Automated checks: root `npm test`, root `npm run typecheck`, Expo Web export and ESLint on all changed TypeScript/test files. Added regression coverage for combined-refresh delegation, accessible bookmark/loading states, removal of the duplicate review refresh and hiding scores/unsupported reasons. Existing Save/Join edge-case tests remain in the suite.

Additional isolated browser validation used the production export at 390px and 1280px viewport widths. All external Supabase requests were intercepted with fixtures; unexpected writes were rejected. The combined refresh was checked against changed fixture bookmark/registration/review responses and increased read counts for activities, bookmarks, participants and ratings. Screens were visually compared with the PDF. This is not live Supabase verification; no shared data, SQL or deployment was touched.
