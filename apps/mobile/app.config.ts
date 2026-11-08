import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Browser Google Maps uses EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY in the map
 * component. GOOGLE_MAPS_API_KEY is only needed for native builds.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const nativeApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const plugins = [...(config.plugins ?? [])];

  const nextConfig: ExpoConfig = {
    ...config,
    name: config.name ?? 'CommunityLink',
    slug: config.slug ?? 'communitylink',
    plugins,
  };

  if (nativeApiKey && nativeApiKey !== 'YOUR_GOOGLE_MAPS_API_KEY') {
    nextConfig.plugins = [
      ...plugins,
      [
        'react-native-maps',
        {
          androidGoogleMapsApiKey: nativeApiKey,
          iosGoogleMapsApiKey: nativeApiKey,
        },
      ],
    ];
  }

  return nextConfig;
};
