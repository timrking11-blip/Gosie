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
  budgetLevel: number;
  travelMinutes: number;
  fit: Record<Context, number>;
  why: string;
};
const budgetOptions = [
  { label: 'Up to $', value: 1 },
  { label: 'Up to $$', value: 2 },
  { label: 'Any', value: null },
] as const;
type BudgetLimit = (typeof budgetOptions)[number]['value'];
const travelOptions = [10, 15, 25] as const;

const ideas: Idea[] = [
  { title: 'Late set at a small jazz room', kind: 'Music', when: 'Sat · evening', budget: '$$', budgetLevel: 2, travelMinutes: 20, fit: { All: 9, Solo: 7, Friends: 7, Date: 10, Group: 5 }, why: 'Sample interest: live music. This event and its details are fictional.' },
  { title: 'Restored-print film night', kind: 'Film', when: 'Fri · 8 pm', budget: '$', budgetLevel: 1, travelMinutes: 12, fit: { All: 8, Solo: 10, Friends: 7, Date: 8, Group: 6 }, why: 'Sample interest: classic cinema. This event and its details are fictional.' },
  { title: 'Long lunch, shared plates', kind: 'Food', when: 'Sun · midday', budget: '$$', budgetLevel: 2, travelMinutes: 15, fit: { All: 8, Solo: 4, Friends: 10, Date: 7, Group: 9 }, why: 'Sample interest: relaxed meals. No personal preference was used to create this fictional example.' },
  { title: 'Riverside walk & market', kind: 'Outdoors', when: 'Sun · morning', budget: 'Free', budgetLevel: 0, travelMinutes: 8, fit: { All: 7, Solo: 9, Friends: 8, Date: 6, Group: 8 }, why: 'Sample interest: time outdoors. This event and its details are fictional.' },
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

function IdeaCard({
  idea,
  index,
  context,
  expanded,
  saved,
  rating,
  onToggle,
  onSave,
  onDismiss,
  onRate,
}: {
  idea: Idea;
  index: number;
  context: Context;
  expanded: boolean;
  saved: boolean;
  rating: number | null;
  onToggle: () => void;
  onSave: () => void;
  onDismiss: () => void;
  onRate: (rating: number) => void;
}) {
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
        <View style={styles.metaItem}><Feather name="tag" size={12} color={C.gold} /><Text style={styles.detailText}>Sample {idea.budget}</Text></View>
        <View style={styles.metaItem}><Feather name="map-pin" size={12} color={C.gold} /><Text style={styles.detailText}>{idea.travelMinutes} min · sample</Text></View>
      </View>
      <View style={styles.feedbackActions}>
        <TouchableOpacity
          onPress={onSave}
          accessibilityRole="button"
          accessibilityLabel={`${saved ? 'Unsave' : 'Save'} ${idea.title} for this demo session`}
          accessibilityState={{ selected: saved }}
          style={[styles.feedbackButton, saved && styles.feedbackButtonSelected]}
        >
          <Feather name="bookmark" size={14} color={saved ? C.cream : C.peach} />
          <Text style={[styles.feedbackButtonText, saved && styles.feedbackButtonTextSelected]}>{saved ? 'Saved' : 'Save'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${idea.title} for this demo session`}
          style={styles.feedbackButton}
        >
          <Feather name="x-circle" size={14} color={C.peach} />
          <Text style={styles.feedbackButtonText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.ratingRow}>
        <Text style={styles.ratingLabel}>Rate this</Text>
        <View style={styles.ratingControls}>
          {[1, 2, 3, 4, 5].map((score) => (
            <TouchableOpacity
              key={score}
              onPress={() => onRate(score)}
              accessibilityRole="button"
              accessibilityLabel={`Rate ${idea.title} ${score} out of 5 stars`}
              accessibilityState={{ selected: rating === score }}
              style={styles.ratingButton}
            >
              <Feather name="star" size={15} color={rating !== null && score <= rating ? C.gold : '#f5f0e580'} fill={rating !== null && score <= rating ? C.gold : 'transparent'} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingValue} accessibilityLabel={rating === null ? 'Not rated' : `Rated ${rating} out of 5`}>
          {rating === null ? '—' : `${rating}/5`}
        </Text>
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
  const [budgetLimit, setBudgetLimit] = useState<BudgetLimit>(2);
  const [travelLimit, setTravelLimit] = useState<(typeof travelOptions)[number]>(25);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savedIdeas, setSavedIdeas] = useState<string[]>([]);
  const [dismissedIdeas, setDismissedIdeas] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const withinSampleLimits = ideas.filter((idea) =>
    (budgetLimit === null || idea.budgetLevel <= budgetLimit) && idea.travelMinutes <= travelLimit,
  );
  const ranked = [...withinSampleLimits].sort((a, b) => b.fit[context] - a.fit[context]);
  const visibleIdeas = ranked.filter((idea) => !dismissedIdeas.includes(idea.title));
  const dismissedList = ideas.filter((idea) => dismissedIdeas.includes(idea.title));
  const ratedCount = Object.keys(ratings).length;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <Header />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroHalo} />
          <Text style={styles.eyebrow}>Weekend Ahead · life in motion</Text>
          <Text style={styles.heroTitle}>Leave a little room for <Text style={styles.heroItalic}>something good.</Text></Text>
          <Text style={styles.heroBody}>Choose who's coming to reorder fictional ideas using preset scores. This demo also lets you set sample budget and travel limits to filter the list. These temporary controls are not saved preferences, and the listings are not real.</Text>
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
          <View style={styles.limitPanel}>
            <Text style={styles.limitHeading}>Try sample limits</Text>
            <Text style={styles.limitLabel}>Budget cap · illustrative</Text>
            <View style={styles.limitOptions} accessibilityRole="radiogroup" accessibilityLabel="Sample budget cap">
              {budgetOptions.map((option) => {
                const selected = budgetLimit === option.value;
                return (
                  <TouchableOpacity
                    key={option.label}
                    onPress={() => setBudgetLimit(option.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={`${option.label} sample budget cap`}
                    accessibilityState={{ selected }}
                    style={[styles.limitOption, selected && styles.limitOptionSelected]}
                  >
                    <Text style={[styles.limitOptionText, selected && styles.limitOptionTextSelected]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.limitLabel}>Travel cap · illustrative</Text>
            <View style={styles.limitOptions} accessibilityRole="radiogroup" accessibilityLabel="Sample travel cap">
              {travelOptions.map((minutes) => {
                const selected = travelLimit === minutes;
                return (
                  <TouchableOpacity
                    key={minutes}
                    onPress={() => setTravelLimit(minutes)}
                    accessibilityRole="radio"
                    accessibilityLabel={`Up to ${minutes} minutes sample travel cap`}
                    accessibilityState={{ selected }}
                    style={[styles.limitOption, selected && styles.limitOptionSelected]}
                  >
                    <Text style={[styles.limitOptionText, selected && styles.limitOptionTextSelected]}>{minutes} min</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.limitNote}>These controls filter fictional examples on this screen only. Selections are not saved or synced; prices and travel times are illustrative.</Text>
          </View>
          <View style={styles.preferenceList}>
            <View style={styles.preference}><Feather name="coffee" size={13} color={C.forest} /><Text style={styles.preferenceText}>Pace · illustrative label</Text></View>
          </View>
          <View style={styles.demoNotice} accessibilityLiveRegion="polite">
            <Text style={styles.demoNoticeTitle}>Demo feedback · current session only</Text>
            <Text style={styles.demoNoticeSummary}>{savedIdeas.length} saved · {dismissedIdeas.length} dismissed · {ratedCount} rated</Text>
            <Text style={styles.demoNoticeBody}>These actions are temporary and local to this screen. Nothing is stored or synced; state can reset when you reload or close the app.</Text>
          </View>

          <View style={styles.rankedHeader}>
            <Text style={styles.rankedLabel}>Sample matches · <Text style={styles.rankedActive}>{context}</Text></Text>
            <Text style={styles.rankedCount}>{visibleIdeas.length.toString().padStart(2, '0')} IDEAS</Text>
          </View>
          <View style={styles.ideaList}>
            {visibleIdeas.map((idea, index) => (
              <IdeaCard
                key={idea.title}
                idea={idea}
                index={index}
                context={context}
                expanded={expanded === idea.title}
                saved={savedIdeas.includes(idea.title)}
                rating={ratings[idea.title] ?? null}
                onToggle={() => setExpanded(expanded === idea.title ? null : idea.title)}
                onSave={() => setSavedIdeas((current) => current.includes(idea.title)
                  ? current.filter((title) => title !== idea.title)
                  : [...current, idea.title])}
                onDismiss={() => setDismissedIdeas((current) => current.includes(idea.title) ? current : [...current, idea.title])}
                onRate={(rating) => setRatings((current) => ({ ...current, [idea.title]: rating }))}
              />
            ))}
          </View>
          {visibleIdeas.length === 0 && (
            <Text style={styles.emptyIdeas}>All sample ideas are dismissed. Restore one below to bring it back.</Text>
          )}
          {dismissedList.length > 0 && (
            <View style={styles.dismissedPanel}>
              <Text style={styles.dismissedHeading}>Dismissed this session</Text>
              {dismissedList.map((idea) => (
                <View key={idea.title} style={styles.dismissedRow}>
                  <Text style={styles.dismissedTitle}>{idea.title}</Text>
                  <TouchableOpacity
                    onPress={() => setDismissedIdeas((current) => current.filter((title) => title !== idea.title))}
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${idea.title}`}
                    style={styles.restoreButton}
                  >
                    <Text style={styles.restoreText}>Restore</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <View style={styles.note}>
            <Feather name="info" size={15} color={C.bronze} />
          <Text style={styles.noteText}>Budget and travel caps filter this fictional list. Social context orders the remaining ideas by preset scores; feedback does not change their ranking.</Text>
          </View>
          <Text style={styles.disclaimer}>Illustrative preview · fictional listings, prices and travel times · limits and feedback are temporary and not saved or synced.</Text>
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
  limitPanel: { marginTop: 15, padding: 12, borderWidth: 1, borderColor: C.border, borderRadius: 13, backgroundColor: C.secondary },
  limitHeading: { color: C.forest, fontFamily: 'Manrope_700Bold', fontSize: 12 },
  limitLabel: { color: C.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 10, marginTop: 10, marginBottom: 6 },
  limitOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  limitOption: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, backgroundColor: C.cream },
  limitOptionSelected: { borderColor: C.forest, backgroundColor: C.forest },
  limitOptionText: { color: C.mutedForeground, fontFamily: 'Manrope_700Bold', fontSize: 11 },
  limitOptionTextSelected: { color: C.cream },
  limitNote: { color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 9, lineHeight: 14, marginTop: 10 },
  preferenceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 },
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
  feedbackActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  feedbackButton: { flex: 1, minHeight: 40, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, borderColor: '#f5f0e533', backgroundColor: '#f5f0e50a' },
  feedbackButtonSelected: { backgroundColor: C.forest, borderColor: C.forest },
  feedbackButtonText: { color: C.cream, fontFamily: 'Manrope_700Bold', fontSize: 10 },
  feedbackButtonTextSelected: { color: C.cream },
  ratingRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3, marginTop: 6 },
  ratingLabel: { color: '#f5f0e5bd', fontFamily: 'Manrope_600SemiBold', fontSize: 9 },
  ratingControls: { flexDirection: 'row', alignItems: 'center' },
  ratingButton: { width: 38, height: 40, justifyContent: 'center', alignItems: 'center' },
  ratingValue: { minWidth: 25, color: C.gold, textAlign: 'right', fontFamily: 'Manrope_700Bold', fontSize: 9 },
  demoNotice: { marginTop: 13, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#94664055', backgroundColor: C.secondary },
  demoNoticeTitle: { color: C.forest, fontFamily: 'Manrope_700Bold', fontSize: 10 },
  demoNoticeSummary: { color: C.forest, fontFamily: 'Manrope_600SemiBold', fontSize: 10, marginTop: 4 },
  demoNoticeBody: { color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 9, lineHeight: 14, marginTop: 4 },
  emptyIdeas: { color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 11, lineHeight: 17, textAlign: 'center', padding: 18 },
  dismissedPanel: { marginTop: 11, padding: 12, borderRadius: 12, backgroundColor: C.secondary },
  dismissedHeading: { color: C.forest, fontFamily: 'Manrope_700Bold', fontSize: 10, marginBottom: 5 },
  dismissedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  dismissedTitle: { flex: 1, color: C.ink, fontFamily: 'Manrope_400Regular', fontSize: 10 },
  restoreButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 9 },
  restoreText: { color: C.forest, fontFamily: 'Manrope_700Bold', fontSize: 10 },
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
