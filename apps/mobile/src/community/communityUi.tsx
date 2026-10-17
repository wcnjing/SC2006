import { useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { validatePostImageUrl, type Neighbourhood } from '@communitylink/shared';
import { colors, CONTENT_MAX_WIDTH, MIN_TOUCH, radii, spacing, typography } from '../theme/tokens';

// Central English copy; Summer can map these keys into the shell's useT() later.
export const communityText = {
  title: 'Community',
  latest: 'Latest neighbourhood posts',
  create: 'Create post',
  edit: 'Edit post',
  publish: 'Publish post',
  save: 'Save changes',
  saving: 'Saving…',
  neighbourhood: 'Neighbourhood',
  body: 'Your post',
  bodyPlaceholder: 'Share something with your neighbours…',
  image: 'Image URL (optional)',
  imageHint: 'Attach one existing HTTPS image link.',
  refresh: 'Refresh posts',
  retry: 'Try again',
  more: 'Load older posts',
  empty: 'No posts in this neighbourhood yet. Be the first to share something.',
  noNeighbourhoods: 'No neighbourhoods are available yet.',
  unavailable: 'This post is unavailable. It may have been deleted or removed.',
  noPermission: 'You can only edit your own posts.',
  authorFallback: 'Community member',
  loadError: 'Unable to load this content. Please try again.',
  saveError: 'Unable to save your post. Your draft is still here. Please try again.',
  delete: 'Delete post',
  deleteConfirm: 'Permanently delete this post? Its comments and likes will also be deleted.',
  deleteAction: 'Delete permanently',
  deleteCancel: 'Keep post',
  deleting: 'Deleting…',
  deleteError: 'Unable to delete your post. Please try again.',
  imageError: 'The attached image could not be displayed.',
  comments: 'Comments',
  commentPlaceholder: 'Join the conversation…',
  commentLabel: 'Your comment',
  sendComment: 'Post comment',
  sendingComment: 'Posting…',
  emptyComments: 'No comments yet. Start the conversation.',
  olderComments: 'Load older comments',
  refreshComments: 'Refresh comments',
  editComment: 'Edit comment',
  deleteComment: 'Delete comment',
  confirmDeleteComment: 'Permanently delete this comment?',
  keepComment: 'Keep comment',
  deleteCommentAction: 'Delete comment permanently',
  cancelEdit: 'Cancel edit',
  commentPosted: 'Comment posted.',
  commentError: 'Unable to save your comment. Your draft is still here. Please try again.',
  like: 'Like post',
  unlike: 'Unlike post',
  likeError: 'Unable to update your like. Please try again.',
  retryLikes: 'Retry likes',
  reportPost: 'Report post',
  reportComment: 'Report comment',
  reportReason: 'Report reason',
  reportDetails: 'Additional details (optional)',
  submitReport: 'Submit report',
  submittingReport: 'Submitting…',
  cancelReport: 'Cancel report',
  reportSent: 'Report submitted. You can track it in My reports.',
  reportError:
    'Unable to submit your report. Your reason and details are still here. Please try again.',
  reportHint:
    'Tell us why this content should be reviewed. Reporting sends it for review; it does not remove it immediately.',
  myReports: 'My reports',
  refreshReports: 'Refresh reports',
  olderReports: 'Load older reports',
  emptyReports: 'You have not submitted any reports yet.',
  reportHistoryHint:
    'Your submitted reports and their review status. Reports remain here if the content is deleted.',
  reportStatuses: { open: 'Open', actioned: 'Action taken', dismissed: 'Dismissed' },
  moderation: 'Admin moderation',
  moderationAudit: 'Moderation audit log',
  adminOnly: 'Only active admins can access moderation.',
  allReports: 'All reports',
  emptyModeration: 'No reports match this status.',
  reviewReport: 'Review report',
  reportUnavailable: 'This report is unavailable.',
  currentContent: 'Current reported content',
  alreadyRemoved: 'This content was already removed.',
  deletedModerationContent: 'This content was deleted. You can dismiss the report with a reason.',
  unsupportedModerationContent:
    'Content review and removal currently support posts and comments. This report can still be dismissed.',
  refreshReview: 'Refresh review',
  moderationReason: 'Moderation reason',
  moderationReasonHint: 'Visible to the reporter and recorded in the audit log.',
  removeContent: 'Remove content',
  resolveRemoved: 'Resolve as already removed',
  dismissReport: 'Dismiss report',
  confirmRemovalHint:
    'Confirm removal and resolve this report? The decision will be recorded in the audit log.',
  confirmDismissalHint:
    'Dismiss this report and keep the content? The decision will be recorded in the audit log.',
  confirmRemove: 'Confirm removal',
  confirmDismiss: 'Confirm dismissal',
  keepReviewing: 'Keep reviewing',
  moderationError:
    'Unable to save this decision. Your reason is still here. Refresh the review or retry.',
  refreshAudit: 'Refresh audit log',
  olderAudit: 'Load older audit entries',
  emptyAudit: 'No moderation decisions have been recorded yet.',
} as const;

export function CommunityButton({
  label,
  onPress,
  disabled = false,
  secondary = false,
  selected,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        communityStyles.button,
        secondary && communityStyles.secondaryButton,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[communityStyles.buttonLabel, secondary && { color: colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CommunityError({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={communityStyles.error}>
      {children}
    </Text>
  );
}

export function NeighbourhoodPicker({
  neighbourhoods,
  selectedId,
  onSelect,
  disabled = false,
}: {
  neighbourhoods: Neighbourhood[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={communityStyles.section}>
      <Text style={communityStyles.label}>{communityText.neighbourhood}</Text>
      <ScrollView horizontal contentContainerStyle={communityStyles.row}>
        {neighbourhoods.map((neighbourhood) => (
          <Pressable
            key={neighbourhood.id}
            accessibilityRole="button"
            accessibilityLabel={`${neighbourhood.name} neighbourhood`}
            accessibilityState={{ selected: selectedId === neighbourhood.id, disabled }}
            disabled={disabled}
            onPress={() => onSelect(neighbourhood.id)}
            style={[
              communityStyles.chip,
              selectedId === neighbourhood.id && communityStyles.selectedChip,
            ]}
          >
            <Text style={communityStyles.body}>
              {selectedId === neighbourhood.id ? '✓ ' : ''}
              {neighbourhood.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function PostImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || validatePostImageUrl(url)) return <Text>{communityText.imageError}</Text>;
  return (
    <Image
      source={{ uri: url }}
      accessibilityLabel="Image attached to the community post"
      style={communityStyles.image}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

export const communityStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  section: { gap: spacing.sm },
  card: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  heading: { ...typography('h2'), color: colors.text },
  body: { ...typography('body'), color: colors.text },
  label: { ...typography('label'), color: colors.text },
  muted: { ...typography('caption'), color: colors.textMuted },
  error: { ...typography('body'), color: colors.error },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    ...typography('body'),
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: MIN_TOUCH,
  },
  multiline: { minHeight: 160, textAlignVertical: 'top' },
  chip: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  selectedChip: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  button: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonLabel: { ...typography('button'), color: colors.onPrimary },
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: radii.md },
});
