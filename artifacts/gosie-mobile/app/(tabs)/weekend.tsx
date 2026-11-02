import React, { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import colors from '@/constants/colors';

const C = colors.light;
const contexts = ['All', 'Solo', 'Friends', 'Date', 'Group'] as const;
type Context = (typeof contexts)[number];
type Idea = {
  title: string;
  kind: string;
  when: string;
  budget: string;
  travel: string;
  fit: Record<Context, number>;
  why: string;
};
const ideas: Idea[] = [
  { title: 'Late set at a small jazz room', kind: 'Music', when: 'Sat · evening', budget: '$$', travel: '20 min', fit: { All: 9, Solo: 7, Friends: 7, Date: 10, Group: 5 }, why: 'You saved two live-music ideas last month and kept Saturday evening open.' },
  { title: 'Restored-print film night', kind: 'Film', when: 'Fri · 8 pm', budget: '$', travel: '12 min', fit: { All: 8, Solo: 10, Friends: 7, Date: 8, Group: 6 }, why: "You rated a classic-cinema idea highly, and it's within your travel bound." },
  { title: 'Long lunch, shared plates', kind: 'Food', when: 'Sun · midday', budget: '$$', travel: '15 min', fit: { All: 8, Solo: 4, Friends: 10, Date: 7, Group: 9 }, why: "Matches your 'unhurried weekends' preference and moderate budget." },
  { title: 'Riverside walk & market', kind: 'Outdoors', when: 'Sun · morning', budget: 'Free', travel: '8 min', fit: { All: 7, Solo: 9, Friends: 8, Date: 6, Group: 8 }, why: 'A low-key counterweight to a busy week ahead.' },
];

function Header() {
  return (
    <View style={styles.topbar}>
      <View style={styles.brandLockup}>
        <Svg width={32} height={32} viewBox="0 0 64 64">
          <Circle cx="32" cy="32" r="32" fill={C.forest} />
          <Path d="M22 52c-1-9 6-13 8-20 1.6-5.5-3-7.5-3-13 0-5 3.6-8.5 8-8.5 4 0 7 2.7 7.4 6.3-1.5 1.9-4 2.8-6.6 2.8-.6 4.4 3.8 8.6 3.8 15.4 0 7.5-6 12.5-17.6 17Z" fill={C.cream} />
          <Path d="M42.2 15.6l7.6 1.8-7.6 2.4c.4-1.4.4-2.8 0-4.2Z" fill={C.peach} />
          <Circle cx="37.2" cy="15.2" r="1.3" fill={C.forest} />
        </Svg>
        <Text style={styles.wordmark}>gosie<Text style={styles.wordmarkDot}>.</Text></Text>
      </View>
      <View style={styles.devPill}><View style={styles.statusDot} /><Text style={styles.devText}>In development</Text></View>
    </View>
  );
}

function IdeaCard({ idea, index, context, expanded, onToggle }: { idea: Idea; index: number; context: Context; expanded: boolean; onToggle: () => void }) {
  const fit = idea.fit[context];
  return (
    <View style={styles.ideaCard}>
      <View style={styles.cardTopline}>
        <Text style={styles.rank}>0{index + 1}</Text>
        <View style={styles.fitWrap} accessibilityLabel={`Fit ${fit} of 10`}>
          <View style={styles.fitTrack}><View style={[styles.fitFill, { width: `${fit * 10}%` }]} /></View>
          <Text style={styles.fitScore}>{fit}<Text style={styles.fitOutOf}> / 10</Text></Text>
        </View>
      </View>
      <Text style={styles.ideaMeta}>{idea.kind} <Text style={styles.metaDot}>·</Text> {idea.when}</Text>
      <Text style={styles.ideaTitle}>{idea.title}</Text>
      <View style={styles.cardFooter}>
        <View style={styles.metaItem}><Feather name="tag" size={12} color={C.gold} /><Text style={styles.detailText}>{idea.budget}</Text></View>
        <View style={styles.metaItem}><Feather name="map-pin" size={12} color={C.gold} /><Text style={styles.detailText}>{idea.travel} away</Text></View>
      </View>
      <TouchableOpacity onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }} style={styles.whyButton}>
        <Text style={styles.whyLabel}>Why this idea?</Text>
        <Feather name={expanded ? 'minus' : 'plus'} size={15} color={C.peach} />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.explanation}>
          <View style={styles.explanationLine} />
          <Text style={styles.whyText}>{idea.why}</Text>
        </View>
      )}
    </View>
  );
}

export default function WeekendScreen() {
  const [context, setContext] = useState<Context>('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const ranked = [...ideas].sort((a, b) => b.fit[context] - a.fit[context]);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <Header />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroHalo} />
          <Text style={styles.eyebrow}>Weekend Ahead · life in motion</Text>
          <Text style={styles.heroTitle}>Leave a little room for <Text style={styles.heroItalic}>something good.</Text></Text>
          <Text style={styles.heroBody}>A late jazz set, a restored film, a long lunch with friends. Tell Gosie who's coming—solo, friends, a date, a group—and watch the ideas re-rank. Budget, travel and pace stay in your hands.</Text>
          <View style={styles.exampleTag}><View style={styles.exampleDot} /><Text style={styles.exampleText}>Example demo</Text></View>
        </View>

        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Weekend Ahead · life in motion</Text>
              <Text style={styles.sectionTitle}>Things to do</Text>
            </View>
            <Feather name="compass" size={20} color={C.bronze} />
          </View>
          <Text style={styles.contextPrompt}>Who's coming?</Text>
          <View style={styles.contextGroup} accessibilityRole="radiogroup" accessibilityLabel="Who's coming">
            {contexts.map((choice) => (
              <TouchableOpacity key={choice} onPress={() => setContext(choice)} accessibilityRole="radio" accessibilityState={{ selected: context === choice }} style={[styles.contextPill, context === choice && styles.contextSelected]}>
                <Text style={[styles.contextText, context === choice && styles.contextSelectedText]}>{choice}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.preferenceList}>
            <View style={styles.preference}><Feather name="dollar-sign" size={13} color={C.forest} /><Text style={styles.preferenceText}>Budget · up to $$</Text></View>
            <View style={styles.preference}><Feather name="map" size={13} color={C.forest} /><Text style={styles.preferenceText}>Travel · under 25 min</Text></View>
            <View style={styles.preference}><Feather name="coffee" size={13} color={C.forest} /><Text style={styles.preferenceText}>Pace · unhurried</Text></View>
          </View>

          <View style={styles.rankedHeader}>
            <Text style={styles.rankedLabel}>Re-ranked for <Text style={styles.rankedActive}>{context}</Text></Text>
            <Text style={styles.rankedCount}>04 IDEAS</Text>
          </View>
          <View style={styles.ideaList}>
            {ranked.map((idea, index) => (
              <IdeaCard key={idea.title} idea={idea} index={index} context={context} expanded={expanded === idea.title} onToggle={() => setExpanded(expanded === idea.title ? null : idea.title)} />
            ))}
          </View>
          <View style={styles.note}>
            <Feather name="info" size={15} color={C.bronze} />
          <Text style={styles.noteText}>Try the pills on the card. Each idea can tell you why it's there.</Text>
          </View>
          <Text style={styles.disclaimer}>Illustrative preview · fictional data · not real listings, prices or availability.</Text>
          <View style={styles.footer}>
            <Text style={styles.footerText}>A little help for everything ahead.</Text>
            <Text style={styles.footerBrand}>gosie.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  topbar: { height: 62, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.espresso, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f5f0e520' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { color: C.cream, fontFamily: 'Fraunces_500Medium', fontSize: 25, letterSpacing: -1.2 },
  wordmarkDot: { color: C.peach },
  devPill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#f5f0e512', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: C.peach },
  devText: { color: C.cream, fontFamily: 'Manrope_700Bold', fontSize: 10, letterSpacing: 0.15 },
  scrollContent: { paddingBottom: 30 },
  hero: { backgroundColor: C.espresso, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 29, overflow: 'hidden' },
  heroHalo: { position: 'absolute', width: 210, height: 210, borderRadius: 110, right: -92, top: -100, backgroundColor: '#94664030' },
  eyebrow: { color: C.peach, fontFamily: 'Manrope_700Bold', fontSize: 9, letterSpacing: 1.45, textTransform: 'uppercase' },
  heroTitle: { color: C.cream, fontFamily: 'Fraunces_400Regular', fontSize: 35, lineHeight: 40, letterSpacing: -1.15, marginTop: 11 },
  heroItalic: { color: C.peach, fontStyle: 'italic' },
  heroBody: { color: '#f5f0e5ba', fontFamily: 'Manrope_400Regular', fontSize: 12.5, lineHeight: 21, marginTop: 13 },
  exampleTag: { marginTop: 17, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#f5f0e532', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 6 },
  exampleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold },
  exampleText: { color: '#f5f0e5b8', fontFamily: 'Manrope_700Bold', fontSize: 8, letterSpacing: 1.05, textTransform: 'uppercase' },
  content: { paddingHorizontal: 17, paddingTop: 23 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionEyebrow: { color: C.bronze, fontFamily: 'Manrope_700Bold', fontSize: 9, letterSpacing: 1.3, textTransform: 'uppercase' },
  sectionTitle: { color: C.ink, fontFamily: 'Fraunces_400Regular', fontSize: 27, marginTop: 3 },
  contextPrompt: { color: C.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 11, marginTop: 19, marginBottom: 9 },
  contextGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  contextPill: { borderRadius: 22, borderWidth: 1, borderColor: C.border, paddingHorizontal: 15, paddingVertical: 8, backgroundColor: C.cream },
  contextSelected: { backgroundColor: C.forest, borderColor: C.forest },
  contextText: { color: C.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 11 },
  contextSelectedText: { color: C.cream },
  preferenceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 13 },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, backgroundColor: C.secondary, paddingHorizontal: 8, paddingVertical: 7 },
  preferenceText: { color: C.forest, fontFamily: 'Manrope_600SemiBold', fontSize: 9 },
  rankedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  rankedLabel: { color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 11 },
  rankedActive: { color: C.forest, fontFamily: 'Manrope_700Bold' },
  rankedCount: { color: C.bronze, fontFamily: 'Manrope_700Bold', fontSize: 8, letterSpacing: 1.2 },
  ideaList: { gap: 9 },
  ideaCard: { backgroundColor: C.espresso, borderColor: '#94664066', borderWidth: 1, borderRadius: 17, paddingHorizontal: 15, paddingTop: 14, paddingBottom: 11 },
  cardTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  rank: { color: C.peach, fontFamily: 'Fraunces_500Medium', fontSize: 24, lineHeight: 27 },
  fitWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fitTrack: { width: 48, height: 4, borderRadius: 3, backgroundColor: '#ffffff20', overflow: 'hidden' },
  fitFill: { height: 4, borderRadius: 3, backgroundColor: C.peach },
  fitScore: { minWidth: 28, color: C.cream, fontFamily: 'Manrope_700Bold', fontSize: 10 },
  fitOutOf: { color: '#f5f0e57b', fontFamily: 'Manrope_400Regular', fontSize: 8 },
  ideaMeta: { color: C.gold, fontFamily: 'Manrope_700Bold', fontSize: 8, letterSpacing: 1.15, textTransform: 'uppercase' },
  metaDot: { color: '#f5f0e578' },
  ideaTitle: { color: C.cream, fontFamily: 'Fraunces_500Medium', fontSize: 21, lineHeight: 27, marginTop: 4 },
  cardFooter: { flexDirection: 'row', gap: 15, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { color: '#f5f0e58b', fontFamily: 'Manrope_400Regular', fontSize: 10 },
  whyButton: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f5f0e520', marginTop: 12, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  whyLabel: { color: C.peach, fontFamily: 'Manrope_700Bold', fontSize: 10 },
  explanation: { flexDirection: 'row', gap: 9, marginTop: 10, paddingBottom: 2 },
  explanationLine: { width: 2, borderRadius: 2, backgroundColor: C.peach },
  whyText: { flex: 1, color: '#f5f0e5bd', fontFamily: 'Manrope_400Regular', fontSize: 10.5, lineHeight: 17 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16, padding: 12, backgroundColor: C.secondary, borderRadius: 12 },
  noteText: { flex: 1, color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 10, lineHeight: 15 },
  disclaimer: { color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 9, lineHeight: 15, textAlign: 'center', marginTop: 17, marginHorizontal: 8 },
  footer: { marginTop: 23, paddingTop: 16, borderTopColor: C.border, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 2 },
  footerText: { color: C.bronze, fontFamily: 'Fraunces_400Regular', fontSize: 15 },
  footerBrand: { color: C.forest, fontFamily: 'Fraunces_500Medium', fontSize: 11 },
});
