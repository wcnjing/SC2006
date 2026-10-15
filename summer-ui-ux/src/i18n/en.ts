/**
 * English strings — the canonical key set. Every other locale is a
 * Partial of this and falls back to English per key.
 *
 * Keys are grouped by screen/feature with a dotted prefix. Use {name}
 * placeholders for interpolation: t('home.greeting', { name: 'Mrs Tan' }).
 */
export const en = {
  // App
  'app.name': 'CommunityLink',
  'app.tagline': 'A stronger Singapore, together.',

  // Common
  'common.back': 'Go back',
  'common.next': 'Next',
  'common.save': 'Save',
  'common.saveChanges': 'Save changes',
  'common.cancel': 'Cancel',
  'common.done': 'Done',
  'common.optional': '(Optional)',
  'common.required': 'Required',
  'common.loading': 'Loading…',
  'common.select': 'Select…',
  'common.or': 'or',
  'common.selected': 'selected',
  'common.comingSoon': 'Coming soon',
  'common.tryAgain': 'Try again',
  'common.showPassword': 'Show password',
  'common.hidePassword': 'Hide password',
  'common.close': 'Close',
  'common.retry': 'Retry',

  // Tabs
  'tab.home': 'Home',
  'tab.discover': 'Discover',
  'tab.map': 'Map',
  'tab.community': 'Community',
  'tab.profile': 'Profile',

  // Auth: login
  'login.phone': 'Phone number',
  'login.phonePlaceholder': 'Enter your 8-digit phone number',
  'login.password': 'Password',
  'login.passwordPlaceholder': 'Enter your password',
  'login.submit': 'Log in',
  'login.singpass': 'Log in with',
  'login.singpassA11y': 'Log in with Singpass',
  'login.noAccount': "Don't have an account?",
  'login.signUp': 'Sign up',
  'login.sessionExpired':
    'You were logged out after 30 minutes of inactivity. Please log in again.',
  'login.demoHint': 'Demo accounts (mock backend): see README',

  // Auth: register
  'register.title': 'Create your account',
  'register.subtitle': 'Join our community today!',
  'register.confirmPassword': 'Confirm password',
  'register.confirmPlaceholder': 'Re-enter your password',
  'register.passwordRules':
    'At least 8 characters, with an uppercase letter, a lowercase letter and a number.',
  'register.haveAccount': 'Already have an account or want to use Singpass?',
  'register.logIn': 'Log in',

  // Singpass (mock)
  'singpass.title': 'Singpass',
  'singpass.mockBanner': 'Mock Singpass for development. No real Singpass data is used.',
  'singpass.consentTitle': 'CommunityLink is requesting your data',
  'singpass.consentBody':
    'With your consent, Singpass will share the following with CommunityLink:',
  'singpass.field.name': 'Name',
  'singpass.field.phone': 'Mobile number',
  'singpass.field.residential': 'Registered address (neighbourhood only)',
  'singpass.mockIdentity': 'Mock identity to log in as',
  'singpass.allow': 'I agree',
  'singpass.deny': 'Cancel',
  'singpass.pdpa': 'Your data is handled in line with the PDPA and Singpass data-sharing policies.',

  // Validation / errors
  'error.phoneRequired': 'Enter your phone number.',
  'error.phoneFormat': 'Enter a valid 8-digit Singapore number starting with 3, 6, 8 or 9.',
  'error.phoneTaken':
    'This phone number is already registered. Log in instead, or use a different number.',
  'error.passwordRequired': 'Enter your password.',
  'error.passwordWeak':
    'Password must be at least 8 characters, with an uppercase letter, a lowercase letter and a number.',
  'error.passwordMismatch': 'Passwords do not match.',
  'error.invalidCredentials': 'Incorrect phone number or password.',
  'error.suspended': 'This account is suspended. Contact support for help.',
  'error.singpassFailed':
    'Singpass login was cancelled or failed. Please try again or log in with your phone number.',
  'error.displayNameRequired': 'Enter a display name.',
  'error.displayNameLength': 'Display name must be 2 to 30 characters.',
  'error.neighbourhoodRequired': 'Select your neighbourhood.',
  'error.noChanges': 'Change at least one detail before saving.',
  'error.imageFormat': 'That file type is not supported. Choose a JPG, PNG or WEBP image.',
  'error.generic': 'Something went wrong. Please try again.',
  'error.activityFull': 'Sorry, this activity just became full.',
  'error.activityUnavailable': 'This activity can no longer be joined.',
  'error.notFound': 'This activity is no longer available.',
  'error.busy': 'Please wait, we are still saving your last action.',
  'error.timeout': 'This is taking longer than usual. Please try again.',
  'error.formSummary': 'Please fix the highlighted fields.',

  // Profile setup / edit
  'profile.completeTitle': 'Complete your profile',
  'profile.completeSubtitle': 'Help us recommend the best events for you!',
  'profile.editTitle': 'Edit profile',
  'profile.photo': 'Profile photo',
  'profile.addPhoto': 'Add profile photo',
  'profile.changePhoto': 'Change profile photo',
  'profile.removePhoto': 'Remove photo',
  'profile.displayName': 'Display name',
  'profile.displayNamePlaceholder': 'e.g. John',
  'profile.displayNameHint': 'This is the name other people will see.',
  'profile.neighbourhood': 'Your neighbourhood',
  'profile.interests': 'What are you interested in?',
  'profile.interestsHint': 'Pick as many as you like.',
  'profile.accessibility': 'Accessibility preferences',
  'profile.accessibilityHint': 'We use these to recommend activities that suit you.',
  'profile.create': 'Create profile',
  'profile.saved': 'Profile saved.',

  // Profile tab
  'profile.edit': 'Edit profile',
  'profile.posts': '{count} community posts',
  'profile.eventsJoined': '{count} events joined',
  'profile.friends': '{count} friends',
  'profile.myActivities': 'My activities',
  'profile.friendRequests': 'Friend requests',
  'profile.messages': 'Direct messages',
  'profile.organiserDashboard': 'Organiser dashboard',
  'profile.adminDashboard': 'Admin dashboard',
  'profile.settings': 'Settings',
  'profile.logout': 'Log out',
  'profile.noInterests': 'No interests added yet.',
  'profile.sectionActivity': 'Your activity',
  'profile.sectionConnect': 'Connect',
  'profile.sectionManage': 'Manage',
  'profile.sectionAccount': 'Account',
  'profile.neighbourhoodLabel': 'Neighbourhood',
  'profile.interestsLabel': 'Interests',
  'profile.accessLabel': 'Accessibility',

  // Settings
  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.languageHint': 'Some screens are still only available in English.',
  'settings.textSize': 'Text size',
  'settings.textSize.default': 'Default',
  'settings.textSize.large': 'Large',
  'settings.textSize.xlarge': 'Extra large',
  'settings.preview': 'Preview: Community Gardening this Saturday at 9:00 AM.',
  'settings.reduceMotion': 'Reduce motion',
  'settings.reduceMotionHint':
    'Turns off card animations and uses buttons instead of swipe animations.',
  'settings.uiKit': 'UI kit gallery (developers)',

  // Home (FR 5.1.5–5.1.6, UC ViewRecommendations)
  'home.greeting.morning': 'Good morning, {name}',
  'home.greeting.afternoon': 'Good afternoon, {name}',
  'home.greeting.evening': 'Good evening, {name}',
  'home.search': 'Search activities…',
  'home.recommended': 'Recommended for you',
  'home.nearby': 'Happening nearby',
  'home.seeAll': 'See all',
  'home.notifications': 'Notifications',
  'home.openProfile': 'Open your profile',
  'home.locationLine': '{place}, Singapore',
  'home.recommendedEmpty': 'No recommendations right now',
  'home.recommendedEmptyBody':
    'There are no upcoming activities that match your accessibility preferences yet. Try Discover to browse everything.',
  'home.notPersonalised':
    'Add interests to your profile to get more personal recommendations. For now these are sorted by distance and popularity.',
  'home.addInterests': 'Add interests',
  'home.nearbyEmpty': 'Nothing else is happening near you this week.',
  'home.browseAll': 'Browse all activities',
  'home.loadError': 'We could not load activities. Check your connection and try again.',

  // Recommendation reasons (FR 5.1.6). Built on the device from structured data, so they translate.
  'reason.interestNear': 'Recommended because you like {interests} and it is {distance} away',
  'reason.interest': 'Recommended because you like {interests}',
  'reason.near': 'Recommended because it is {distance} away from you',
  'reason.popular': 'Popular: {count} neighbours have joined',
  'reason.fallback': 'Upcoming in your area',
  'reason.and': 'and',

  // Shared activity bits
  'activity.distanceM': '{value} m away',
  'activity.distanceKm': '{value} km away',
  'activity.indoor': 'Indoor',
  'activity.outdoor': 'Outdoor',
  'activity.free': 'Free',
  'activity.cost': '$ {value}',
  'activity.full': 'Full',
  'activity.cancelled': 'Cancelled',
  'activity.openA11y': '{title}. {when}. {where}. Opens activity details.',

  // Discover (FR 3.2, UC BrowseActivity)
  'discover.title': 'Discover',
  'discover.subtitle': 'Swipe right to save, left to skip. Or use the buttons below.',
  'discover.progress': '{current} of {total}',
  'discover.skip': 'Skip',
  'discover.skipA11y': 'Not interested, skip {title}',
  'discover.save': 'Save',
  'discover.saveA11y': 'Interested, save {title} to My activities',
  'discover.details': 'View details',
  'discover.savedToast': 'Saved "{title}" to My activities.',
  'discover.skippedToast': 'Skipped "{title}". It will not show again this session.',
  'discover.cardA11y':
    '{title}. {when}. {where}. Swipe right to save or left to skip, or use the Save and Skip buttons.',
  'discover.swipeHintSave': 'Save',
  'discover.swipeHintSkip': 'Skip',
  'discover.keyboardHint': 'Keyboard: ← skip, → save, Enter for details.',
  'discover.endTitle': "You've seen everything for now",
  'discover.endBody':
    'There are no more activities in your queue. Check My activities for the ones you saved, or come back later for new ones.',
  'discover.goMyActivities': 'Go to My activities',
  'discover.actionError': 'We could not record that. The card is back so you can try again.',

  // Activity details (FR 3.1, 9.1.5, UC ViewActivity / JoinActivity / SaveActivity)
  'detail.title': 'Activity details',
  'detail.report': 'Report this activity',
  'detail.ratingSummary': '{avg} ({count} reviews)',
  'detail.ratingA11y': 'Rated {avg} out of 5 from {count} reviews',
  'detail.noRatings': 'No ratings yet',
  'detail.organisedBy': 'Organised by',
  'detail.verifiedOrganiser': 'Verified organiser',
  'detail.publicDataset': 'Listed from public data (data.gov.sg)',
  'detail.about': 'About',
  'detail.info': 'Good to know',
  'detail.capacity': 'Capacity',
  'detail.capacityValue': '{joined} of {capacity} going',
  'detail.capacityOpen': '{joined} going · no limit',
  'detail.price': 'Price',
  'detail.setting': 'Setting',
  'detail.reviews': 'Ratings and reviews',
  'detail.reviewsEmpty': 'No reviews yet. People who join can rate it after it ends.',
  'detail.rate': 'Rate this activity',
  'detail.stars': '{count} out of 5 stars',
  'detail.save': 'Save',
  'detail.saved': 'Saved',
  'detail.saveA11y': 'Save activity',
  'detail.unsaveA11y': 'Saved. Tap to remove from saved activities',
  'detail.join': 'Join activity',
  'detail.leave': 'Cancel my spot',
  'detail.joined': "You're going",
  'detail.joinedToast': "You've joined {title}. See it under My activities → Upcoming.",
  'detail.leftToast': 'Your spot has been cancelled.',
  'detail.savedToast': 'Saved to My activities.',
  'detail.unsavedToast': 'Removed from saved activities.',
  'detail.fullNote': 'This activity is full. Save it to keep an eye on it.',
  'detail.startedNote': 'This activity has already started, so it can no longer be joined.',
  'detail.leaveTitle': 'Cancel your spot?',
  'detail.leaveBody':
    'Your spot will be given to someone else. You can join again later if there is still space.',
  'detail.leaveConfirm': 'Cancel my spot',
  'detail.leaveKeep': 'Keep my spot',
  'detail.unavailableTitle': 'Activity no longer available',
  'detail.unavailableBody': 'This activity has been cancelled or removed by the organiser.',

  // My activities (Dialog Map: displayUpcomingSavedPast)
  'myActivities.title': 'My activities',
  'myActivities.tabs': 'Activity lists',
  'myActivities.upcoming': 'Upcoming',
  'myActivities.saved': 'Saved',
  'myActivities.past': 'Past',
  'myActivities.viewDetails': 'View details',
  'myActivities.rate': 'Rate',
  'myActivities.unsave': 'Remove {title} from saved',
  'myActivities.emptyUpcoming': 'No upcoming activities',
  'myActivities.emptyUpcomingBody': 'Activities you join will show up here.',
  'myActivities.emptySaved': 'No saved activities',
  'myActivities.emptySavedBody':
    'Swipe right in Discover, or tap Save on an activity, to keep it here.',
  'myActivities.emptyPast': 'No past activities',
  'myActivities.emptyPastBody':
    'Activities you joined will move here after they end, so you can rate them.',
  'myActivities.discover': 'Discover activities',
  'myActivities.goingBadge': 'Going',

  // Confirm dialog
  'dialog.dismiss': 'Close dialog',

  // Placeholder screens
  'placeholder.body': 'This screen is part of the shell. Its content will be built by {owner}.',
  'placeholder.covers': 'Covers',

  // Neighbourhoods (P1 reference data)
  'neighbourhood.angMoKio': 'Ang Mo Kio',
  'neighbourhood.bedok': 'Bedok',
  'neighbourhood.bishan': 'Bishan',
  'neighbourhood.bukitBatok': 'Bukit Batok',
  'neighbourhood.bukitMerah': 'Bukit Merah',
  'neighbourhood.bukitPanjang': 'Bukit Panjang',
  'neighbourhood.choaChuKang': 'Choa Chu Kang',
  'neighbourhood.clementi': 'Clementi',
  'neighbourhood.geylang': 'Geylang',
  'neighbourhood.hougang': 'Hougang',
  'neighbourhood.jurongEast': 'Jurong East',
  'neighbourhood.jurongWest': 'Jurong West',
  'neighbourhood.kallang': 'Kallang',
  'neighbourhood.pasirRis': 'Pasir Ris',
  'neighbourhood.punggol': 'Punggol',
  'neighbourhood.queenstown': 'Queenstown',
  'neighbourhood.sembawang': 'Sembawang',
  'neighbourhood.sengkang': 'Sengkang',
  'neighbourhood.serangoon': 'Serangoon',
  'neighbourhood.tampines': 'Tampines',
  'neighbourhood.toaPayoh': 'Toa Payoh',
  'neighbourhood.woodlands': 'Woodlands',
  'neighbourhood.yishun': 'Yishun',

  // Categories / interests (P1 INTERESTS)
  'category.sports': 'Sports',
  'category.fitness': 'Fitness',
  'category.artsCrafts': 'Arts & Crafts',
  'category.music': 'Music',
  'category.cooking': 'Cooking',
  'category.gardening': 'Gardening',
  'category.volunteering': 'Volunteering',
  'category.learning': 'Learning',
  'category.technology': 'Technology',
  'category.games': 'Games',
  'category.outdoors': 'Outdoors',
  'category.wellness': 'Wellness',
  'category.social': 'Social',

  // Accessibility tags (P1 ACCESSIBILITY_NEEDS)
  'access.wheelchair': 'Wheelchair-accessible',
  'access.elderly': 'Elderly-friendly',
  'access.hearing': 'Hearing support',
  'access.visual': 'Visual support',
  'access.lowIntensity': 'Low physical intensity',

  // Languages (always shown in their own script)
  'lang.en': 'English',
  'lang.zh': '中文',
  'lang.ms': 'Bahasa Melayu',
  'lang.ta': 'தமிழ்',
} as const;

export type TranslationKey = keyof typeof en;
export type Translations = Partial<Record<TranslationKey, string>>;
