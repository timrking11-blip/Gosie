import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityCard, communityStyles as s } from '@/components/CommunityFeed';
import { mobileCommunityRequest as request, useCommunityItems } from '@/hooks/useCommunity';
import type { CommunityDraft, CommunityMine, CommunityItem, CommunityComment } from '../../../../lib/community/api';

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
  const button = (label: string, action: () => void) => <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={action} style={s.button}><Text style={s.buttonText}>{label}</Text></TouchableOpacity>;
  const field = (label: string, value: string, onChangeText: (value: string) => void, multiline = false) =>
    <View style={{ gap: 5 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChangeText} multiline={multiline} autoCapitalize="none" /></View>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f0e5' }} edges={['top']}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={s.title}>Gosie Communities</Text>
    <Text style={s.body}>Shared by people, reviewed before appearing here. Community content is separate from Gosie's fictional examples. Confirm dates and availability with the source.</Text>
    {message !== '' && <Text accessibilityRole="alert" style={s.body}>{message}</Text>}
    {button('Refresh Communities', () => { void feed.refresh(); void loadPrivate(); })}
    {feed.loading ? <ActivityIndicator accessibilityLabel="Loading approved community content" /> : feed.error ? <Text accessibilityRole="alert" style={s.body}>Communities couldn't load: {feed.error}</Text> :
      feed.items.length === 0 ? <Text style={s.body}>No current approved contributions yet. No sample listings have been substituted.</Text> :
        feed.items.map((item) => <CommunityCard item={item} key={item.id}>
          {mine?.roles.includes('restaurant-owner') && item.kind === 'event' && !item.expired && <>
            {field(`Owner comment for ${item.title}`, comments[item.id] || '', (value) => setComments((current) => ({ ...current, [item.id]: value })), true)}
            {button('Send comment for approval', () => void act(async () => { await mutate(`/community/items/${item.id}/comments`, { text: comments[item.id] }); setComments((current) => ({ ...current, [item.id]: '' })); }, 'Comment submitted privately for moderation.'))}
          </>}
        </CommunityCard>)}
    {privateError !== '' && <Text accessibilityRole="alert" style={s.body}>Your private submissions couldn't load: {privateError}</Text>}
    {!mine ? <View style={s.card}><Text style={s.title}>Already invited?</Text><Text style={s.body}>Sign in with an existing Gosie account. Registration remains closed. Contributor and restaurant-owner permissions are assigned separately, never by this form.</Text>
      {field('Email', email, setEmail)}
      <Text style={s.label}>Password</Text><TextInput accessibilityLabel="Password" secureTextEntry style={s.input} value={password} onChangeText={setPassword} autoCapitalize="none" />
      {button('Sign in', () => void act(async () => { await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); setPassword(''); }, 'Signed in.'))}
    </View> : <>
      <Text style={s.body}>Permissions: {mine.roles.join(', ') || 'approved-feed reader'}. Your pending and rejected content is private.</Text>
      {(mine.roles.includes('contributor') || mine.roles.includes('restaurant-owner')) && <View style={s.card}>
        <Text style={s.title}>Share a find</Text><Text style={s.body}>Your chosen attribution, location, description and source will be public only after approval. Do not include private personal details.</Text>
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
      {mine.items.map((item) => <CommunityCard key={item.id} item={item} />)}
      {mine.comments.map((comment) => <View key={comment.id} style={s.card}><Text style={s.label}>{comment.status} · your owner comment</Text><Text style={s.body}>{comment.text}</Text></View>)}
      {queue && <View style={{ gap: 14 }}><Text style={s.title}>Moderator review</Text><Text style={s.body}>Only pending content is shown. You cannot approve your own contributions.</Text>
        {queue.items.length === 0 && queue.comments.length === 0 && <Text style={s.body}>The review queue is empty.</Text>}
        {queue.items.map((item) => <CommunityCard item={item} key={item.id}><View style={s.row}>{(['approved', 'rejected'] as const).map((decision) => <React.Fragment key={decision}>{button(decision === 'approved' ? 'Approve find' : 'Reject find', () => void act(() => mutate(`/community/moderation/items/${item.id}`, { decision }), `Find ${decision}.`))}</React.Fragment>)}</View></CommunityCard>)}
        {queue.comments.map((comment) => <View key={comment.id} style={s.card}><Text style={s.label}>{comment.attribution} · owner comment for {comment.itemId}</Text><Text style={s.body}>{comment.text}</Text><View style={s.row}>{(['approved', 'rejected'] as const).map((decision) => <React.Fragment key={decision}>{button(decision === 'approved' ? 'Approve comment' : 'Reject comment', () => void act(() => mutate(`/community/moderation/comments/${comment.id}`, { decision }), `Comment ${decision}.`))}</React.Fragment>)}</View></View>)}
      </View>}
      {button('Sign out of Communities', () => void act(() => mutate('/auth/logout', {}), 'Signed out.'))}
    </>}
  </ScrollView></SafeAreaView>;
}
