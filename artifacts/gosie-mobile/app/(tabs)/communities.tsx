import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityCard, communityStyles as s } from '../../components/CommunityFeed';
import { mobileCommunityRequest as request, useCommunityItems } from '../../hooks/useCommunity';
import type { CommunityDraft, CommunityMine, CommunityItem, CommunityComment } from '../../../../lib/community/api';
import { hasOrganizationRole } from '../../../../lib/community/api';
import { REASON_MAX, decisionNote, reasonError, reasonHelp, reviewChecklist } from '../../../../lib/community/moderation';

const emptyDraft: CommunityDraft = { kind: 'gem', title: '', description: '', location: '', attribution: '' };
export default function CommunitiesScreen() {
  const feed = useCommunityItems();
  const [mine, setMine] = useState<CommunityMine | null>(null);
  const [queue, setQueue] = useState<{ items: CommunityItem[]; comments: CommunityComment[] } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [privateError, setPrivateError] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  async function loadPrivate() {
    setPrivateError('');
    try {
      const session = await request<{ authenticated: boolean }>('/auth/session');
      if (!session.authenticated) { setMine(null); setQueue(null); return; }
      const own = await request<CommunityMine>('/community/mine');
      setMine(own);
      setQueue(own.roles.includes('moderator') ? await request('/community/moderation') : null);
    } catch (e) { setMine(null); setQueue(null); setPrivateError(e instanceof Error ? e.message : 'Private content could not load.'); }
  }
  useEffect(() => { void loadPrivate(); }, []);
  async function mutate(path: string, body: unknown) {
    const session = await request<{ csrfToken?: string }>('/auth/session');
    if (!session.csrfToken) throw new Error('Sign in with an existing pilot account first.');
    return request(path, { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify(body) });
  }
  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage('');
    try { await action(); setMessage(success); await Promise.all([feed.refresh(), loadPrivate()]); }
    catch (e) { setMessage(e instanceof Error ? e.message.replace(/_/g, ' ') : 'This change could not be saved.'); }
    finally { setBusy(false); }
  }
  const button = (label: string, action: () => void, disabled = false) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy || disabled }} disabled={busy || disabled} onPress={action} style={[s.button, (busy || disabled) && { opacity: 0.55 }]}><Text style={s.buttonText}>{label}</Text></TouchableOpacity>;
  const field = (label: string, value: string, onChangeText: (value: string) => void, multiline = false) =>
    <View style={{ gap: 5 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChangeText} multiline={multiline} autoCapitalize="none" /></View>;
  const privateDecision = (record: { status: CommunityItem['status']; decisionReason?: string | null }) => {
    const note = decisionNote(record);
    return note ? <View style={s.comment}><Text style={s.label}>Moderator reason (private to you and moderators)</Text><Text style={s.body}>{note}</Text></View> : null;
  };
  const decide = (kind: 'items' | 'comments', record: { id: string; canReview?: boolean }, noun: string) => {
    if (record.canReview === false) return <Text style={s.label}>You cannot review your own contribution. Another moderator will decide.</Text>;
    const key = `${kind}:${record.id}`;
    const reason = reasons[key] || '';
    const invalid = reasonError(reason);
    const label = `Reason for decision on this ${noun} (required)`;
    return <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} accessibilityHint={reasonHelp} editable={!busy} maxLength={REASON_MAX} multiline style={s.input} value={reason} onChangeText={(value) => setReasons((current) => ({ ...current, [key]: value }))} />
      <Text style={s.meta}>{reasonHelp} {reason.trim().length}/{REASON_MAX}</Text>
      {reason !== '' && invalid !== '' && <Text accessibilityRole="alert" style={s.meta}>{invalid}</Text>}
      <View style={s.row}>{(['approved', 'rejected'] as const).map((decision) => <React.Fragment key={decision}>{button(`${decision === 'approved' ? 'Approve' : 'Reject'} ${noun}`, () => void act(async () => { await mutate(`/community/moderation/${kind}/${record.id}`, { decision, decisionReason: reason.trim() }); setReasons((current) => ({ ...current, [key]: '' })); }, `${noun === 'find' ? 'Find' : 'Comment'} ${decision}.`), invalid !== '')}</React.Fragment>)}</View>
    </View>;
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f0e5' }} edges={['top']}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={s.title}>Gosie Communities</Text>
    <Text style={s.body}>For people. Made better by local knowledge—not an advertising directory. Invited people, restaurants, venues, municipalities, and nonprofits can share useful local finds. Every contribution is moderated. Community content is separate from Gosie's fictional examples. Confirm details with the source.</Text>
    {message !== '' && <Text accessibilityRole="alert" style={s.body}>{message}</Text>}
    {button('Refresh Communities', () => { void feed.refresh(); void loadPrivate(); })}
    {feed.loading ? <ActivityIndicator accessibilityLabel="Loading approved community content" /> : feed.error ? <Text accessibilityRole="alert" style={s.body}>Communities couldn't load: {feed.error}</Text> :
      feed.items.length === 0 ? <Text style={s.body}>No current approved contributions yet. No sample listings have been substituted.</Text> :
        feed.items.map((item) => <CommunityCard item={item} key={item.id}>
          {mine && hasOrganizationRole(mine.roles) && item.kind === 'event' && !item.expired && <>
            {field(`Organization note for ${item.title}`, comments[item.id] || '', (value) => setComments((current) => ({ ...current, [item.id]: value })), true)}
            <Text style={s.body}>Share useful practical details, not advertising. Notes use your operator-designated organization name and need separate approval.</Text>
            {button('Send comment for approval', () => void act(async () => { await mutate(`/community/items/${item.id}/comments`, { text: comments[item.id] }); setComments((current) => ({ ...current, [item.id]: '' })); }, 'Comment submitted privately for moderation.'))}
          </>}
        </CommunityCard>)}
    {privateError !== '' && <Text accessibilityRole="alert" style={s.body}>Your private submissions couldn't load: {privateError}</Text>}
    {!mine ? <View style={s.card}><Text style={s.title}>Already invited?</Text><Text style={s.body}>Sign in with an existing Gosie account. Registration remains closed. Contributor and organization permissions are assigned separately, never by this form. Venues, municipalities, and nonprofits are welcome through this moderated process.</Text>
      {field('Email', email, setEmail)}
      <Text style={s.label}>Password</Text><TextInput accessibilityLabel="Password" secureTextEntry style={s.input} value={password} onChangeText={setPassword} autoCapitalize="none" />
      {button('Sign in', () => void act(async () => { await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); setPassword(''); }, 'Signed in.'))}
    </View> : <>
      <Text style={s.body}>Permissions: {mine.roles.join(', ') || 'approved-feed reader'}. Your pending and rejected content is private.</Text>
      {(mine.roles.includes('contributor') || hasOrganizationRole(mine.roles)) && <View style={s.card}>
        <Text style={s.title}>Share a find for people</Text><Text style={s.body}>Share useful local knowledge, not advertising. Attribution, location, description and source become public only after approval. Organization posts use the operator-designated name, not the attribution entered here. Do not include private personal details.</Text>
        <View style={s.row}>{(['gem', 'event'] as const).map((kind) => <TouchableOpacity key={kind} accessibilityRole="radio" accessibilityState={{ checked: draft.kind === kind }} style={s.button} onPress={() => setDraft((current) => ({ ...current, kind, startsAt: undefined, endsAt: undefined }))}><Text style={s.buttonText}>{draft.kind === kind ? 'Selected: ' : ''}{kind === 'gem' ? 'Evergreen gem' : 'Timed event'}</Text></TouchableOpacity>)}</View>
        {(['title', 'description', 'location', 'attribution', 'sourceUrl'] as const).map((key) => <React.Fragment key={key}>{field(key === 'sourceUrl' ? 'Source link (optional HTTPS)' : key, draft[key] || '', (value) => setDraft((current) => ({ ...current, [key]: value })), key === 'description')}</React.Fragment>)}
        {draft.kind === 'event' && <><Text style={s.body}>Include a timezone: for example 2026-12-01T19:00:00-05:00. Ends must follow starts.</Text>
          {field('Starts (ISO date, time and timezone)', draft.startsAt || '', (value) => setDraft((current) => ({ ...current, startsAt: value })))}
          {field('Ends (ISO date, time and timezone)', draft.endsAt || '', (value) => setDraft((current) => ({ ...current, endsAt: value })))}
        </>}
        {button('Submit privately for approval', () => void act(async () => { await mutate('/community/items', draft); setDraft(emptyDraft); }, 'Find submitted privately. It is not published until approved.'))}
      </View>}
      <Text style={s.title}>Your submissions</Text>
      {mine.items.length === 0 && mine.comments.length === 0 && <Text style={s.body}>Nothing submitted yet.</Text>}
      {mine.items.map((item) => <CommunityCard key={item.id} item={item}>{privateDecision(item)}</CommunityCard>)}
      {mine.comments.map((comment) => <View key={comment.id} style={s.card}><Text style={s.label}>{comment.status} · your organization note</Text><Text style={s.body}>{comment.text}</Text>{privateDecision(comment)}</View>)}
      {queue && <View style={{ gap: 14 }}><Text style={s.title}>Moderator review</Text><Text style={s.body}>Only pending content is shown. You cannot approve your own contributions.</Text>
        <View style={s.card}><Text style={s.label}>Before you decide, check for people first</Text>{reviewChecklist.map((line) => <Text key={line} style={s.body}>- {line}</Text>)}</View>
        {queue.items.length === 0 && queue.comments.length === 0 && <Text style={s.body}>The review queue is empty.</Text>}
        {queue.items.map((item) => <CommunityCard item={item} key={item.id}>{decide('items', item, 'find')}</CommunityCard>)}
        {queue.comments.map((comment) => <View key={comment.id} style={s.card}><Text style={s.label}>{comment.attribution} · organization note for {comment.itemId}</Text><Text style={s.body}>{comment.text}</Text>{decide('comments', comment, 'comment')}</View>)}
      </View>}
      {button('Sign out of Communities', () => void act(() => mutate('/auth/logout', {}), 'Signed out.'))}
    </>}
  </ScrollView></SafeAreaView>;
}
