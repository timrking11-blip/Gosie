import React, { useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import colors from '@/constants/colors';
import { PromoVideo } from '@/components/PromoVideo';

const C = colors.light;
const events = [
  { day: 'Mon', time: '09:30', title: 'Quarterly planning review', cat: 'Work', tone: C.mist },
  { day: 'Mon', time: '18:00', title: 'Climbing session', cat: 'Personal', tone: C.sage },
  { day: 'Tue', time: '11:00', title: 'Design critique · Atlas', cat: 'Work', tone: C.mist },
  { day: 'Wed', time: '08:00', title: 'Dentist', cat: 'Errands', tone: C.gold },
  { day: 'Wed', time: '14:00', title: 'Draft board memo', cat: 'Work', tone: C.mist },
  { day: 'Thu', time: '19:30', title: 'Dinner with Sam & Priya', cat: 'Personal', tone: C.sage },
  { day: 'Fri', time: '16:00', title: 'Renew passport form', cat: 'Errands', tone: C.gold },
];
const busy = [2, 3, 1, 3, 2, 0, 1, 3, 4, 2, 1, 2, 0, 0, 1, 2, 3, 2, 2, 1, 0, 3, 2, 4, 1, 1, 0, 0];
const groups = ['Work', 'Personal', 'Errands'];
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const levelColors = [
  'rgba(245,240,229,0.05)',
  'rgba(166,195,212,0.15)',
  'rgba(166,195,212,0.30)',
  'rgba(166,195,212,0.50)',
  'rgba(166,195,212,0.75)',
];

function GooseMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="32" fill={C.forest} />
      <Path d="M22 52c-1-9 6-13 8-20 1.6-5.5-3-7.5-3-13 0-5 3.6-8.5 8-8.5 4 0 7 2.7 7.4 6.3-1.5 1.9-4 2.8-6.6 2.8-.6 4.4 3.8 8.6 3.8 15.4 0 7.5-6 12.5-17.6 17Z" fill={C.cream} />
      <Path d="M42.2 15.6l7.6 1.8-7.6 2.4c.4-1.4.4-2.8 0-4.2Z" fill={C.peach} />
      <Circle cx="37.2" cy="15.2" r="1.3" fill={C.forest} />
    </Svg>
  );
}

function BrandHeader() {
  return (
    <View style={styles.topbar}>
      <View style={styles.brandLockup}>
        <GooseMark />
        <Text style={styles.wordmark}>gosie<Text style={{ color: C.peach }}>.</Text></Text>
      </View>
      <View style={styles.devPill}><View style={styles.statusDot} /><Text style={styles.devText}>In development</Text></View>
    </View>
  );
}

function Eyebrow({ children, light = false }: { children: string; light?: boolean }) {
  return <Text style={[styles.eyebrow, { color: light ? C.sage : C.forest }]}>{children}</Text>;
}

function ViewSwitch({ view, setView }: { view: 'category' | 'chrono'; setView: (v: 'category' | 'chrono') => void }) {
  return (
    <View style={styles.switchShell} accessibilityRole="tablist" accessibilityLabel="Group week by">
      {(['category', 'chrono'] as const).map((v) => (
        <TouchableOpacity key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: view === v }} style={[styles.switchOption, view === v && styles.switchSelected]}>
          <Text style={[styles.switchText, view === v && styles.switchTextActive]}>{v === 'category' ? 'Category' : 'Chronological'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EventGroup({ heading, view }: { heading: string; view: 'category' | 'chrono' }) {
  const matching = events.filter((item) => (view === 'category' ? item.cat === heading : item.day === heading));
  return (
    <View style={styles.groupCard}>
      <Text style={styles.groupHeading}>{heading}</Text>
      {matching.map((item) => (
        <View key={item.title} style={styles.eventRow}>
          <View style={[styles.eventBullet, { backgroundColor: item.tone }]} />
          <View style={styles.eventCopy}>
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventMeta}>{view === 'category' ? item.day : item.cat} · {item.time}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function WeekScreen() {
  const [view, setView] = useState<'category' | 'chrono'>('category');
  const headings = view === 'category' ? groups : days;
  const visibleGroups = useMemo(() => headings.filter((heading) =>
    events.some((item) => (view === 'category' ? item.cat === heading : item.day === heading))), [headings, view]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <BrandHeader />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Eyebrow>Personal intelligence, with a personal touch</Eyebrow>
          <Text style={styles.pageTitle}>Make more of the <Text style={styles.italicTitle}>life ahead.</Text></Text>
          <Text style={styles.introBody}>Your plans, priorities, and possibilities—brought together by a thoughtful sidekick.</Text>
        </View>

        <PromoVideo />

        <View style={styles.weekPanel}>
          <View style={styles.weekPanelTop}>
            <View>
              <Text style={styles.panelEyebrow}>Week Ahead</Text>
              <Text style={styles.panelTitle}>Week of 9 November</Text>
            </View>
            <Feather name="more-horizontal" size={20} color={C.mist} />
          </View>
          <View style={styles.panelDivider} />

          <View style={styles.analyticsRow}>
            <View style={styles.heatCard}>
              <View style={styles.heatHeader}><Text style={styles.darkLabel}>MONTHLY GRID</Text><Text style={styles.darkLabel}>NOV</Text></View>
              <View style={styles.heatGrid}>
                {busy.map((value, index) => (
                  <View key={index} style={[styles.heatCell, { backgroundColor: levelColors[value] }, index >= 7 && index < 14 && styles.currentWeekCell]} />
                ))}
              </View>
          <Text style={styles.heatHint}>Monthly grid · Nov</Text>
            </View>
            <View style={styles.statsStack}>
              <View style={styles.statCard}>
                <Text style={styles.darkLabel}>WORK · LIFE</Text>
                <View style={styles.ratioBar}><View style={styles.workRatio} /><View style={styles.lifeRatio} /></View>
                <Text style={styles.statValue}>62 <Text style={styles.statSlash}>/</Text> 38</Text>
              </View>
              <View style={[styles.statCard, styles.openEvenings]}>
                <Text style={styles.darkLabel}>OPEN EVENINGS</Text>
                <View style={styles.eveningRow}><Text style={styles.eveningNumber}>3</Text></View>
              </View>
            </View>
          </View>

          <View style={styles.priorityCard}>
            <View style={styles.priorityHeading}><Feather name="bookmark" size={14} color={C.gold} /><Text style={styles.priorityTitle}>Priority rail</Text></View>
            {['Board memo draft by Wed', 'Confirm Thursday dinner', 'Passport renewal'].map((item, index) => (
              <View key={item} style={styles.priorityRow}><Text style={styles.priorityNumber}>0{index + 1}</Text><Text style={styles.priorityCopy}>{item}</Text><Feather name="arrow-up-right" size={13} color={C.mist} /></View>
            ))}
          </View>
        </View>

        <View style={styles.sectionIntro}>
          <View><Eyebrow>Week Ahead · executive clarity</Eyebrow><Text style={styles.sectionTitle}>See your week in perspective.</Text></View>
          <ViewSwitch view={view} setView={setView} />
        </View>
        <Text style={styles.weekDescription}>Work and personal plans, grouped the way you think. Switch between category and chronological views, spot the heavy days early, and get a short digest of what deserves attention first.</Text>
        <View style={styles.groupsGrid}>
          {visibleGroups.map((heading) => <EventGroup key={heading} heading={heading} view={view} />)}
        </View>

        <View style={styles.digest}>
          <View style={styles.digestIcon}><GooseMark size={30} /></View>
          <View style={styles.digestContent}>
            <Text style={styles.digestLabel}>Digest</Text>
            <Text style={styles.digestBody}>Wednesday is your heaviest day. Moving the memo draft to Tuesday afternoon would leave Thursday evening free.</Text>
          </View>
          <Feather name="arrow-up-right" size={17} color={C.forest} />
        </View>
        <Text style={styles.disclaimer}>Illustrative preview · fictional data · not real listings, prices or availability.</Text>
        <View style={styles.bottomNote}><Text style={styles.bottomNoteText}>A little help for everything ahead.</Text><Text style={styles.bottomBrand}>gosie.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  topbar: { height: 62, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, backgroundColor: C.cream },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { color: C.forest, fontFamily: 'Fraunces_500Medium', fontSize: 25, letterSpacing: -1.2 },
  devPill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.secondary, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: C.bronze },
  devText: { fontFamily: 'Manrope_700Bold', color: C.forest, fontSize: 10, letterSpacing: 0.15 },
  scrollContent: { paddingBottom: 34 },
  intro: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 22 },
  eyebrow: { fontFamily: 'Manrope_700Bold', fontSize: 9, letterSpacing: 1.55, textTransform: 'uppercase' },
  pageTitle: { marginTop: 10, color: C.ink, fontFamily: 'Fraunces_400Regular', fontSize: 35, lineHeight: 41, letterSpacing: -1.25 },
  italicTitle: { color: C.forest, fontStyle: 'italic' },
  introBody: { marginTop: 12, color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 13, lineHeight: 21 },
  weekPanel: { marginHorizontal: 15, padding: 16, borderRadius: 22, backgroundColor: C.midnight, overflow: 'hidden' },
  weekPanelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 15 },
  panelEyebrow: { color: C.sage, fontFamily: 'Manrope_700Bold', fontSize: 9, letterSpacing: 1.6, textTransform: 'uppercase' },
  panelTitle: { color: C.cream, fontFamily: 'Fraunces_400Regular', fontSize: 22, marginTop: 5 },
  panelDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#f5f0e524', marginBottom: 14 },
  analyticsRow: { flexDirection: 'row', gap: 9 },
  heatCard: { flex: 1.1, backgroundColor: '#f5f0e50c', borderColor: '#f5f0e512', borderWidth: 1, borderRadius: 14, padding: 11 },
  heatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  darkLabel: { color: '#a6c3d4a8', fontFamily: 'Manrope_700Bold', fontSize: 8, letterSpacing: 1.1 },
  heatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  heatCell: { width: '11.25%', aspectRatio: 1, borderRadius: 3 },
  currentWeekCell: { borderWidth: 1, borderColor: '#a6c3d4a0' },
  heatHint: { color: '#f5f0e587', fontFamily: 'Manrope_400Regular', fontSize: 8, marginTop: 9 },
  statsStack: { flex: 0.9, gap: 9 },
  statCard: { flex: 1, backgroundColor: '#f5f0e50c', borderColor: '#f5f0e512', borderWidth: 1, borderRadius: 14, padding: 11, justifyContent: 'center' },
  ratioBar: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 10, marginBottom: 6 },
  workRatio: { width: '62%', backgroundColor: C.mist },
  lifeRatio: { flex: 1, backgroundColor: C.sage },
  statValue: { fontFamily: 'Fraunces_500Medium', color: C.cream, fontSize: 18 },
  statSlash: { color: '#f5f0e570', fontSize: 13 },
  openEvenings: { justifyContent: 'space-between' },
  eveningRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 5 },
  eveningNumber: { color: C.cream, fontFamily: 'Fraunces_500Medium', fontSize: 25 },
  priorityCard: { backgroundColor: '#f5f0e50c', borderColor: '#f5f0e512', borderWidth: 1, borderRadius: 14, marginTop: 10, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 4 },
  priorityHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  priorityTitle: { fontFamily: 'Manrope_700Bold', color: C.cream, fontSize: 11 },
  priorityRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f5f0e516' },
  priorityNumber: { width: 20, color: C.gold, fontFamily: 'Fraunces_500Medium', fontSize: 12 },
  priorityCopy: { flex: 1, color: '#f5f0e5df', fontFamily: 'Manrope_500Medium', fontSize: 10.5 },
  sectionIntro: { paddingHorizontal: 21, paddingTop: 29, paddingBottom: 13, gap: 13 },
  sectionTitle: { color: C.ink, fontFamily: 'Fraunces_400Regular', fontSize: 24, marginTop: 5 },
  weekDescription: { marginHorizontal: 21, marginBottom: 13, marginTop: -5, color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 11, lineHeight: 17 },
  switchShell: { alignSelf: 'flex-start', flexDirection: 'row', backgroundColor: C.muted, borderRadius: 20, padding: 3 },
  switchOption: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 7 },
  switchSelected: { backgroundColor: C.forest },
  switchText: { color: C.mutedForeground, fontFamily: 'Manrope_600SemiBold', fontSize: 10 },
  switchTextActive: { color: C.cream },
  groupsGrid: { paddingHorizontal: 15, gap: 9 },
  groupCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 13 },
  groupHeading: { color: C.bronze, fontFamily: 'Manrope_700Bold', fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 9 },
  eventBullet: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  eventCopy: { flex: 1 },
  eventTitle: { color: C.ink, fontFamily: 'Manrope_600SemiBold', fontSize: 11.5, lineHeight: 16 },
  eventMeta: { color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 9.5, marginTop: 2 },
  digest: { marginHorizontal: 15, marginTop: 17, flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderRadius: 18, backgroundColor: C.secondary, padding: 15 },
  digestIcon: { marginTop: 1 },
  digestContent: { flex: 1 },
  digestLabel: { color: C.forest, fontFamily: 'Manrope_700Bold', fontSize: 8, letterSpacing: 1.2, textTransform: 'uppercase' },
  digestBody: { color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 11, lineHeight: 18, marginTop: 6 },
  disclaimer: { marginHorizontal: 22, marginTop: 17, color: C.mutedForeground, fontFamily: 'Manrope_400Regular', fontSize: 9, lineHeight: 15, textAlign: 'center' },
  bottomNote: { marginTop: 23, paddingTop: 17, borderTopColor: C.border, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 2 },
  bottomNoteText: { color: C.bronze, fontFamily: 'Fraunces_400Regular', fontSize: 15 },
  bottomBrand: { color: C.forest, fontFamily: 'Fraunces_500Medium', fontSize: 11 },
});

export default function TabOneScreen() {
  return <WeekScreen />;
}
