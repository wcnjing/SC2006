import { validCoordinates, type ActivityFilters } from '@communitylink/shared';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ActivityButton as Button } from './activityTheme';

export function requestActivityLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Device location is unavailable. Use a browser with location support.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude };
        if (!validCoordinates(point)) reject(new Error('Device returned an invalid location.'));
        else resolve(point);
      },
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? 'Location permission denied. Allow location access to filter by distance.'
              : 'Unable to get your location. Check location services and try again.',
          ),
        ),
      { timeout: 10000, maximumAge: 60000 },
    );
  });
}

export function ActivityDistanceFilter({
  distance,
  onChange,
}: {
  distance: ActivityFilters['distance'];
  onChange: (distance: ActivityFilters['distance']) => void;
}) {
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  async function locate() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage('');
    try {
      setOrigin(await requestActivityLocation());
      setMessage('Location ready. Choose a distance below.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to get your location.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      <Text>Distance from your device (straight-line km)</Text>
      <Button
        title={pending ? 'Getting location…' : 'Use my current location'}
        disabled={pending}
        onPress={locate}
      />
      {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          title="Any distance"
          color={!distance ? '#075ca8' : '#555'}
          accessibilityLabel={!distance ? 'Any distance, selected' : 'Any distance'}
          onPress={() => onChange(undefined)}
        />
        {[1, 5, 10, 25].map((maxKm) => (
          <Button
            key={maxKm}
            title={`Within ${maxKm} km`}
            disabled={!origin || pending}
            color={distance?.maxKm === maxKm ? '#075ca8' : '#555'}
            accessibilityLabel={`Within ${maxKm} km${distance?.maxKm === maxKm ? ', selected' : ''}`}
            onPress={() => {
              if (origin) onChange({ origin, maxKm });
            }}
          />
        ))}
      </View>
      {!!distance && (
        <Text>
          Activities without valid coordinates are excluded. Location is used only on this page.
        </Text>
      )}
    </View>
  );
}
