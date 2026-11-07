import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
    throw new Error('GOOGLE_MAPS_API_KEY must be set before building the app with Google Maps.');
  }

  const nextConfig: ExpoConfig = {
    ...config,
    name: config.name ?? 'CommunityLink',
    slug: config.slug ?? 'communitylink',
    plugins: [
      ...(config.plugins ?? []),
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: apiKey,
          iosGoogleMapsApiKey: apiKey,
        },
      ],
    ],
  };

  return nextConfig;
};
