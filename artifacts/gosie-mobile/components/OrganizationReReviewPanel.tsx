import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { CommunityItem, OrganizationContentReview } from '../../../lib/community/api';
import { communityWrite } from '../../../lib/community/api';
import { reasonError, REASON_MAX } from '../../../lib/community/moderation';
import { mobileApiBase, mobileCommunityRequest } from '../hooks/useCommunity';
import { communityStyles as s } from './CommunityFeed';

type Queue = { reviews: OrganizationContentReview[]; truncated: boolean };

function displayDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Date unavailable';
}

function ExternalSource({ url, label }: { url: string; label: string }) {
  return <TouchableOpacity accessibilityRole="link" accessibilityLabel={label} style={s.button}
    onPress={() => { void Linking.openURL(url).catch(() => undefined); }}>
    <Text style={s.buttonText}>{label}</Text>
  </TouchableOpacity>;
}

function ParentContext({ parent }: { parent: CommunityItem | null | undefined }) {
  if (!parent) return <Text style={s.meta}>Parent event details are unavailable. Confirm the context before retaining this note.</Text>;
  const starts = displayDate(parent.startsAt);
  return <View style={s.comment}>
    <Text style={s.label}>Parent event: {parent.title}</Text>
    <Text style={s.body}>{parent.description}</Text>
    <Text style={s.body}>{parent.location}</Text>
    <Text style={s.body}>Parent event state: {parent.status}{parent.expired ? ' · past event' : ''}.</Text>
    {starts && <Text style={s.body}>{starts}</Text>}
    {parent.sourceUrl && <ExternalSource url={parent.sourceUrl} label="Check parent event source" />}
  </View>;
}

function ReviewCard({ review, onDone }: {
  review: OrganizationContentReview;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const record = review.content;
  const invalid = reasonError(reason);
  const title = review.contentType === 'items' ? review.content.title : 'Organization note';
  const description = review.contentType === 'items' ? review.content.description : review.content.text;
  const starts = review.contentType === 'items' ? displayDate(review.content.startsAt) : null;
  const ends = review.contentType === 'items' ? displayDate(review.content.endsAt) : null;
  const visibility = record.status === 'pending'
    ? 'Still private; retaining it does not approve it.'
    : record.status === 'approved'
      ? 'Visible in the approved community feed; revocation alone did not remove it.'
      : 'Already private; retaining it does not publish it.';

  const decide = async (action: 'retain' | 'hide' | 'dismiss') => {
    if (busy || invalid || !review.canReview) return;
    setBusy(true);
    setError('');
    try {
      await communityWrite(
        `/community/organization-reviews/${encodeURIComponent(review.revocationId)}/${review.contentType}/${encodeURIComponent(record.id)}`,
        { action, reason: reason.trim(), expectedStatus: record.status },
        mobileApiBase(),
      );
      setReason('');
      setBusy(false);
      onDone(action === 'hide'
        ? 'Contribution kept private after organization re-review. Nothing was published or deleted.'
        : 'Organization re-review recorded. The contribution’s current visibility was not changed.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(message === 'review_changed_refresh_required'
        ? 'This review changed. Refresh the re-review queue before deciding again.'
        : message.replace(/_/g, ' ') || 'The re-review decision could not be saved.');
      setBusy(false);
    }
  };

  return <View style={s.card} accessibilityLabel={`Organization re-review: ${title}`}>
    <Text accessibilityRole="header" style={s.title}>{title}</Text>
    <Text style={s.meta}>{review.publicIdentity} · {review.organizationType} · access revoked {displayDate(review.revokedAt)}</Text>
    <Text style={s.body}>Current state: {record.status}. {visibility}</Text>
    <Text style={s.body}>{description}</Text>
    {review.contentType === 'items' && <>
      <Text style={s.body}>{review.content.location}</Text>
      {starts && <Text style={s.body}>{starts}{ends ? ` – ${ends}` : ''}</Text>}
      {review.content.sourceUrl && <ExternalSource url={review.content.sourceUrl} label="Check the submitted source" />}
    </>}
    {review.contentType === 'comments' && <ParentContext parent={review.parent} />}
    <Text style={s.meta}>Historical attribution: {record.attribution} · {review.contentType === 'comments' ? `parent event ${review.content.itemId}` : review.content.kind}</Text>
    <View style={{ padding: 12, borderRadius: 10, backgroundColor: '#f0eadb', gap: 5 }}>
      <Text style={s.label}>{review.basis === 'legacy-attribution' ? 'Uncertain legacy match' : 'Recorded permission match'}</Text>
      <Text style={s.body}>{review.basis === 'legacy-attribution'
        ? 'This account and attribution match the revoked organization, but the original grant was not recorded. Confirm the relationship; do not assume wrongdoing.'
        : 'Linked by the recorded organization permission used when submitted. This is not proof the content is inaccurate.'}</Text>
    </View>
    {!review.canReview
      ? <Text style={s.meta}>You cannot re-review your own contribution. Another moderator must decide.</Text>
      : <View style={{ gap: 8 }}>
        <Text style={s.label}>Private re-review reason (required)</Text>
        <TextInput accessibilityLabel="Private re-review reason (required)"
          accessibilityHint="Use 10 to 1000 characters. Never public; do not include private personal details."
          editable={!busy} maxLength={REASON_MAX} multiline textAlignVertical="top" numberOfLines={4}
          style={[s.input, { minHeight: 100 }]} value={reason} onChangeText={setReason} />
        <Text style={s.meta}>Use 10–1000 characters. Never public; do not include private personal details. Retain and dismiss reasons stay private; a keep-private reason is also shown to the contributor. {reason.trim().length}/{REASON_MAX}</Text>
        {!!reason && !!invalid && <Text accessibilityRole="alert" style={s.meta}>{invalid}</Text>}
        <View style={s.row}>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy || !!invalid }}
            disabled={busy || !!invalid} style={[s.button, (busy || !!invalid) && { opacity: 0.55 }]}
            onPress={() => void decide('retain')}><Text style={s.buttonText}>Retain current state</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy || !!invalid }}
            disabled={busy || !!invalid} style={[s.button, { backgroundColor: '#f3ded5' }, (busy || !!invalid) && { opacity: 0.55 }]}
            onPress={() => void decide('hide')}><Text style={s.buttonText}>Keep private / remove from feed</Text></TouchableOpacity>
          {review.basis === 'legacy-attribution' && <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy || !!invalid }}
            disabled={busy || !!invalid} style={[s.button, (busy || !!invalid) && { opacity: 0.55 }]}
            onPress={() => void decide('dismiss')}><Text style={s.buttonText}>Dismiss uncertain match</Text></TouchableOpacity>}
        </View>
        {busy && <ActivityIndicator accessibilityLabel="Saving organization re-review" />}
        {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
      </View>}
  </View>;
}

export default function OrganizationReReviewPanel({ onDone }: { onDone: (message: string) => void }) {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setQueue(null);
    setError('');
    mobileCommunityRequest<Queue>('/community/organization-reviews', { signal: controller.signal })
      .then(setQueue)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error
          ? cause.message.replace(/_/g, ' ') : 'Organization re-reviews could not load.');
      });
    return () => controller.abort();
  }, [version]);

  const finish = useCallback((message: string) => {
    onDone(message);
    setVersion((current) => current + 1);
  }, [onDone]);

  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={s.title}>Organization access re-review</Text>
    <Text style={s.label}>Moderators only · historical contributions, not public accusations</Text>
    <Text style={s.body}>Revoked access is a reason to check a contribution, not proof of wrongdoing. Retain useful information for people. Retain leaves approved content approved and pending content private; pending still needs separate approval. Keep private removes approved content from the feed or rejects a pending contribution. Dismiss is only for uncertain legacy matches. None of these actions restores organization permission.</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => setVersion((current) => current + 1)} style={s.button}>
      <Text style={s.buttonText}>Refresh re-review queue</Text>
    </TouchableOpacity>
    {error ? <Text accessibilityRole="alert" style={s.body}>{error}</Text> :
      !queue ? <ActivityIndicator accessibilityLabel="Loading organization re-reviews" /> :
        <>
          {queue.truncated && <Text accessibilityRole="alert" style={s.meta}>Showing the oldest 100 unresolved matches. Resolve these and refresh to see the remaining matches.</Text>}
          {queue.reviews.length === 0 ? <Text style={s.body}>No organization contributions need re-review.</Text> :
            queue.reviews.map((review) => <ReviewCard key={`${review.revocationId}:${review.contentType}:${review.content.id}`} review={review} onDone={finish} />)}
        </>}
  </View>;
}
