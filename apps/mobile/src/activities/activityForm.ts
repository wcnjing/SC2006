import {
  validateActivityInput,
  ApiError,
  type Activity,
  type ActivityInput,
} from '@communitylink/shared';

export interface ActivityFormValues {
  title: string;
  description: string;
  category: string;
  location_name: string;
  address: string;
  starts_at: string;
  ends_at: string;
  capacity: string;
  cost: string;
  lat: string;
  lng: string;
  tags: string;
  accessibility: string;
  is_outdoor: boolean;
}

export function singaporeDateTime(timestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

export function initialActivityForm(activity?: Activity): ActivityFormValues {
  return {
    title: activity?.title ?? '',
    description: activity?.description ?? '',
    category: activity?.category ?? '',
    location_name: activity?.location_name ?? '',
    address: activity?.address ?? '',
    starts_at: activity ? singaporeDateTime(activity.starts_at) : '',
    ends_at: activity ? singaporeDateTime(activity.ends_at) : '',
    capacity: activity?.capacity?.toString() ?? '',
    cost: activity ? (activity.cost_cents / 100).toFixed(2) : '0',
    lat: activity?.lat?.toString() ?? '',
    lng: activity?.lng?.toString() ?? '',
    tags: activity?.tags.join(', ') ?? '',
    accessibility: activity?.accessibility_features.join(', ') ?? '',
    is_outdoor: activity?.is_outdoor ?? false,
  };
}

function parseTime(value: string): string {
  const text = value.trim().replace('T', ' ');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text))
    throw new ApiError('Enter date/time as YYYY-MM-DD HH:mm in Singapore time.', 'validation');
  const date = new Date(`${text.replace(' ', 'T')}:00+08:00`);
  if (!Number.isFinite(date.getTime()) || singaporeDateTime(date.toISOString()) !== text)
    throw new ApiError('Enter a valid calendar date and time.', 'validation');
  return date.toISOString();
}

export function activityFormInput(values: ActivityFormValues, now = Date.now()): ActivityInput {
  if (!/^\d+(\.\d{1,2})?$/.test(values.cost.trim()))
    throw new ApiError(
      'Enter a non-negative SGD cost with up to two decimal places.',
      'validation',
    );
  const number = (text: string) => (text.trim() ? Number(text) : null);
  const list = (text: string) =>
    text
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  return validateActivityInput(
    {
      title: values.title,
      description: values.description,
      category: values.category,
      location_name: values.location_name,
      address: values.address || null,
      starts_at: parseTime(values.starts_at),
      ends_at: parseTime(values.ends_at),
      capacity: number(values.capacity),
      cost_cents: Math.round(Number(values.cost) * 100),
      lat: number(values.lat),
      lng: number(values.lng),
      tags: list(values.tags),
      accessibility_features: list(values.accessibility),
      is_outdoor: values.is_outdoor,
    },
    now,
  );
}
