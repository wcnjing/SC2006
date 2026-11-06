import {
  activityFilterError,
  filterActivities,
  listActivities,
  listNeighbourhoods,
  type ActivityFilters,
} from '@communitylink/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActivityButton as Button, activityStyles } from './activityTheme';
import { supabase } from '../lib/supabase';
import { ActivityDistanceFilter } from './ActivityDistanceFilter';
import { ActivityRecommendationLink } from './ActivityRecommendations';
import { ActivityRatingLinks } from './ActivityRatings';
import { OrganiserActivityLinks } from './OrganiserActivityLinks';
import { useActivityQuery } from './useActivityQuery';

const loadActivities = () => listActivities(supabase);
const loadNeighbourhoods = () => listNeighbourhoods(supabase);

export function ActivityList() {
  const [filters, setFilters] = useState<ActivityFilters>({});
  const { data, loading, error, retry } = useActivityQuery(loadActivities);
  const neighbourhoods = useActivityQuery(loadNeighbourhoods);
  if (loading) return <ActivityIndicator accessibilityLabel="Loading activities" />;
  if (error)
    return (
      <View>
        <Text accessibilityRole="alert">{error}</Text>
        <Button title="Retry activities" onPress={retry} />
      </View>
    );
  const activities = data ?? [];
  const filtered = filterActivities(activities, filters);
  const categories = [...new Set(activities.map((activity) => activity.category))].sort();
  const accessibility = [
    ...new Set(activities.flatMap((activity) => activity.accessibility_features)),
  ].sort();
  const filterError = activityFilterError(filters);
  const hasFilters = Boolean(
    filters.keyword?.trim() ||
    filters.category ||
    filters.location?.trim() ||
    filters.neighbourhoodId !== undefined ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.accessibility?.length ||
    filters.environment ||
    filters.distance,
  );
  return (
    <FlatList
      contentContainerStyle={{ gap: 12 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={activityStyles.card}>
          <Link href="/activities/mine" style={activityStyles.link}>
            My Activities
          </Link>
          <OrganiserActivityLinks />
          <ActivityRatingLinks />
          <ActivityRecommendationLink />
          <Button title="Refresh activities" onPress={retry} />
          <Text accessibilityRole="header" style={activityStyles.heading}>
            Search activities
          </Text>
          <TextInput
            accessibilityLabel="Search activities"
            placeholder="Search titles, descriptions or tags"
            value={filters.keyword ?? ''}
            onChangeText={(keyword) => setFilters((current) => ({ ...current, keyword }))}
            style={styles.input}
          />
          <Text>Category / type</Text>
          <View style={styles.categories}>
            <Button
              title="All categories"
              color={!filters.category ? '#075ca8' : '#555'}
              accessibilityLabel={!filters.category ? 'All categories, selected' : 'All categories'}
              onPress={() => setFilters((current) => ({ ...current, category: '' }))}
            />
            {categories.map((category) => (
              <Button
                key={category}
                title={category}
                color={filters.category === category ? '#075ca8' : '#555'}
                accessibilityLabel={
                  filters.category === category ? `${category}, selected` : category
                }
                onPress={() => setFilters((current) => ({ ...current, category }))}
              />
            ))}
          </View>
          <Text>Neighbourhood</Text>
          <View style={styles.categories}>
            <Button
              title="All neighbourhoods"
              color={filters.neighbourhoodId === undefined ? '#075ca8' : '#555'}
              accessibilityLabel={
                filters.neighbourhoodId === undefined
                  ? 'All neighbourhoods, selected'
                  : 'All neighbourhoods'
              }
              onPress={() => setFilters((current) => ({ ...current, neighbourhoodId: undefined }))}
            />
            {(neighbourhoods.data ?? []).map((neighbourhood) => (
              <Button
                key={neighbourhood.id}
                title={neighbourhood.name}
                color={filters.neighbourhoodId === neighbourhood.id ? '#075ca8' : '#555'}
                accessibilityLabel={`${neighbourhood.name} neighbourhood${filters.neighbourhoodId === neighbourhood.id ? ', selected' : ''}`}
                onPress={() =>
                  setFilters((current) => ({ ...current, neighbourhoodId: neighbourhood.id }))
                }
              />
            ))}
          </View>
          {neighbourhoods.loading && (
            <ActivityIndicator accessibilityLabel="Loading neighbourhoods" />
          )}
          {neighbourhoods.error && (
            <View>
              <Text accessibilityRole="alert">{neighbourhoods.error}</Text>
              <Button title="Retry neighbourhoods" onPress={neighbourhoods.retry} />
            </View>
          )}
          {!neighbourhoods.loading && !neighbourhoods.error && !neighbourhoods.data?.length && (
            <Text>No neighbourhood options available.</Text>
          )}
          <Text>Location</Text>
          <TextInput
            accessibilityLabel="Filter by location"
            placeholder="Venue or address"
            value={filters.location ?? ''}
            onChangeText={(location) => setFilters((current) => ({ ...current, location }))}
            style={styles.input}
          />
          <Text>Start date (Singapore time, inclusive)</Text>
          {(['dateFrom', 'dateTo'] as const).map((key) => (
            <TextInput
              key={key}
              accessibilityLabel={key === 'dateFrom' ? 'From date' : 'To date'}
              placeholder={key === 'dateFrom' ? 'From YYYY-MM-DD' : 'To YYYY-MM-DD'}
              value={filters[key] ?? ''}
              style={styles.input}
              onChangeText={(value) => setFilters((current) => ({ ...current, [key]: value }))}
            />
          ))}
          <Text>Accessibility (all selected features required)</Text>
          <View style={styles.categories}>
            <Button
              title="Any accessibility"
              color={!filters.accessibility?.length ? '#075ca8' : '#555'}
              onPress={() => setFilters((current) => ({ ...current, accessibility: [] }))}
            />
            {accessibility.map((feature) => (
              <Button
                key={feature}
                title={feature}
                color={filters.accessibility?.includes(feature) ? '#075ca8' : '#555'}
                accessibilityLabel={`${feature}${filters.accessibility?.includes(feature) ? ', selected' : ''}`}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    accessibility: current.accessibility?.includes(feature)
                      ? current.accessibility.filter((value) => value !== feature)
                      : [...(current.accessibility ?? []), feature],
                  }))
                }
              />
            ))}
          </View>
          {!accessibility.length && (
            <Text>No accessibility features supplied for these activities.</Text>
          )}
          <Text>Indoor / outdoor</Text>
          <View style={styles.categories}>
            {(['any', 'indoor', 'outdoor'] as const).map((value) => (
              <Button
                key={value}
                title={value === 'any' ? 'Any setting' : value === 'indoor' ? 'Indoor' : 'Outdoor'}
                color={(filters.environment ?? 'any') === value ? '#075ca8' : '#555'}
                accessibilityLabel={`${value} setting${(filters.environment ?? 'any') === value ? ', selected' : ''}`}
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    environment: value === 'any' ? undefined : value,
                  }))
                }
              />
            ))}
          </View>
          <ActivityDistanceFilter
            distance={filters.distance}
            onChange={(distance) => setFilters((current) => ({ ...current, distance }))}
          />
          <Button title="Clear filters" onPress={() => setFilters({})} disabled={!hasFilters} />
          <Text accessibilityLiveRegion="polite">{filtered.length} activities found</Text>
        </View>
      }
      data={filtered}
      keyExtractor={(activity) => activity.id}
      ListEmptyComponent={
        <Text>
          {filterError
            ? filterError
            : hasFilters
              ? 'No activities match your filters.'
              : 'No upcoming activities available.'}
        </Text>
      }
      renderItem={({ item }) => (
        <View style={activityStyles.card}>
          <Link
            href={{ pathname: '/activities/[id]', params: { id: item.id } }}
            style={activityStyles.heading}
          >
            {item.title}
          </Link>
          <View style={activityStyles.row}>
            <Text style={activityStyles.badge}>{item.category}</Text>
            <Text style={activityStyles.badge}>{item.is_outdoor ? 'Outdoor' : 'Indoor'}</Text>
          </View>
          <Text style={activityStyles.body}>{item.location_name}</Text>
          <Text style={activityStyles.body}>{new Date(item.starts_at).toLocaleString()}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  input: activityStyles.input,
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
