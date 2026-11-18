import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import colors from '../constants/colors';
import type { CommunityItem } from '../../../lib/community/api';
const C = colors.light;

export function CommunityCard({ item, children }: { item: CommunityItem; children?: React.ReactNode }) {
  return <View style={styles.card}>
    <Text style={styles.label}>{item.kind === 'gem' ? 'EVERGREEN HIDDEN GEM · NO SCHEDULE' : item.expired ? 'EVENT ENDED' : 'COMMUNITY EVENT'}</Text>
    <Text style={styles.title}>{item.title}</Text>
    <Text style={styles.body}>{item.description}</Text>
    <Text style={styles.body}>{item.location}</Text>
    {item.kind === 'event' && item.startsAt && item.endsAt && <Text style={styles.body}>
      {new Date(item.startsAt).toLocaleString()} – {new Date(item.endsAt).toLocaleString()}
    </Text>}
    <Text style={styles.body}>Shared by {item.attribution} · {item.status}</Text>
    <Text style={styles.meta}>{item.reviewedAt ? `Reviewed ${new Date(item.reviewedAt).toLocaleDateString()}` : 'Awaiting moderation'}</Text>
    <Text style={styles.body}>{item.why}</Text>
    {item.sourceUrl && <TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL(item.sourceUrl!)} style={styles.button}><Text style={styles.buttonText}>Open contributor's source</Text></TouchableOpacity>}
    {item.comments.map((comment) => <View key={comment.id} style={styles.comment}><Text style={styles.label}>{comment.attribution} · ORGANIZATION NOTE</Text><Text style={styles.body}>{comment.text}</Text></View>)}
    {children}
  </View>;
}
const styles = StyleSheet.create({
  page: { padding: 20, gap: 16, paddingBottom: 40, backgroundColor: C.background },
  card: { backgroundColor: C.card, padding: 18, borderWidth: 1, borderColor: C.border, borderRadius: 18, gap: 10 },
  title: { fontFamily: 'Fraunces_500Medium', fontSize: 25, color: C.forest },
  body: { fontFamily: 'Manrope_400Regular', fontSize: 14, lineHeight: 22, color: C.foreground },
  meta: { fontFamily: 'Manrope_400Regular', fontSize: 12, lineHeight: 19, color: C.mutedForeground },
  label: { fontFamily: 'Manrope_700Bold', fontSize: 12, lineHeight: 19, color: C.forest },
  button: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.secondary, justifyContent: 'center' },
  buttonText: { fontFamily: 'Manrope_700Bold', fontSize: 14, color: C.forest },
  comment: { borderTopWidth: 1, borderColor: C.border, paddingTop: 10, gap: 7 },
  input: { minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, color: C.foreground, fontSize: 16, backgroundColor: C.card },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
export const communityStyles = styles;
