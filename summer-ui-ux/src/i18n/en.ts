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

  // Home (shell only — content owned by P2)
  'home.greeting.morning': 'Good morning, {name}',
  'home.greeting.afternoon': 'Good afternoon, {name}',
  'home.greeting.evening': 'Good evening, {name}',
  'home.search': 'Search activities…',
  'home.recommended': 'Recommended for you',
  'home.nearby': 'Happening nearby',
  'home.seeAll': 'See all',
  'home.notifications': 'Notifications',
  'home.openProfile': 'Open your profile',

  // Placeholder screens
  'placeholder.body': 'This screen is part of the shell. Its content will be built by {owner}.',
  'placeholder.covers': 'Covers',

  // Neighbourhoods
  'neighbourhood.angMoKio': 'Ang Mo Kio',
  'neighbourhood.bedok': 'Bedok',
  'neighbourhood.bishan': 'Bishan',
  'neighbourhood.bukitBatok': 'Bukit Batok',
  'neighbourhood.clementi': 'Clementi',
  'neighbourhood.hougang': 'Hougang',
  'neighbourhood.jurongWest': 'Jurong West',
  'neighbourhood.pasirRis': 'Pasir Ris',
  'neighbourhood.punggol': 'Punggol',
  'neighbourhood.sengkang': 'Sengkang',
  'neighbourhood.tampines': 'Tampines',
  'neighbourhood.tanjongPagar': 'Tanjong Pagar',
  'neighbourhood.toaPayoh': 'Toa Payoh',
  'neighbourhood.woodlands': 'Woodlands',
  'neighbourhood.yishun': 'Yishun',

  // Categories / interests
  'category.sports': 'Sports',
  'category.food': 'Food',
  'category.arts': 'Arts',
  'category.nature': 'Nature',
  'category.volunteering': 'Volunteering',
  'category.games': 'Games',
  'category.learning': 'Learning',
  'category.social': 'Social',
  'category.wellness': 'Wellness',

  // Accessibility tags
  'access.wheelchair': 'Wheelchair-accessible',
  'access.elderly': 'Elderly-friendly',
  'access.family': 'Family-friendly',
  'access.sensory': 'Sensory-friendly',
  'access.lowIntensity': 'Low physical intensity',

  // Languages (always shown in their own script)
  'lang.en': 'English',
  'lang.zh': '中文',
  'lang.ms': 'Bahasa Melayu',
  'lang.ta': 'தமிழ்',
} as const;

export type TranslationKey = keyof typeof en;
export type Translations = Partial<Record<TranslationKey, string>>;
