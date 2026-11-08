// Starts the local Mockpass server (the @opengovsg/mockpass npm package) with
// the settings CommunityLink needs: the login page on, and direct ID tokens.
// Values already set in the environment win, so they can still be overridden.
process.env.SHOW_LOGIN_PAGE ??= 'true';
process.env.SINGPASS_CLIENT_PROFILE ??= 'direct';
process.env.MOCKPASS_PORT ??= '5156';

await import('@opengovsg/mockpass/index.js');
