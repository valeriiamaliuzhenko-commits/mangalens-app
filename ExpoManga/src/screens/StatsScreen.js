import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Platform, ActivityIndicator, Dimensions,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';
import { getDetailedStats } from '../services/api';
import { VictoryPie } from 'victory-native';
import Svg, { Path, G } from 'react-native-svg';

const { width: SCREEN_W } = Dimensions.get('window');

const STATUS_META = {
  planned:     { label: 'Planned',     color: Colors.textMuted },
  in_progress: { label: 'In Progress', color: Colors.info },
  done:        { label: 'Done',        color: Colors.success },
  dropped:     { label: 'Dropped',     color: Colors.error },
};

const STAR_META = {
  '5': { label: '5 ★', color: '#F59E0B' },
  '4': { label: '4 ★', color: '#FBBF24' },
  '3': { label: '3 ★', color: '#FCD34D' },
  '2': { label: '2 ★', color: '#A3A3A3' },
  '1': { label: '1 ★', color: '#737373' },
  'unrated': { label: 'Unrated', color: '#374151' },
};

const RANGES = [
  { key: 'week',      label: 'This Week' },
  { key: 'prev_week', label: 'Last Week' },
  { key: 'month',     label: 'Month' },
  { key: 'all',       label: 'All Time' },
];

// ─── Pie Chart using stacked colored arcs ────────────────────────────────────

function PieChart({ entries, size = 150 }) {
  const total = entries.reduce((s, e) => s + e.value, 0);
  const activeEntries = entries.filter(e => e.value > 0);

  if (total === 0) return (
    <View style={{ alignItems: 'center', gap: Spacing.md }}>
      <View style={{ width: size, height: size, borderRadius: size/2, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: Typography.xs, color: Colors.textMuted }}>No data</Text>
      </View>
    </View>
  );

  const cx = size / 2, cy = size / 2;
  const R = size / 2, r = R * 0.56;
  let cumAngle = -Math.PI / 2;

  const slices = activeEntries.map(e => {
    const angle = (e.value / total) * 2 * Math.PI;
    const start = cumAngle;
    cumAngle += angle;
    return { ...e, start, end: cumAngle, angle };
  });

  const arc = (start, end) => {
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
    const ix1 = cx + r * Math.cos(end),  iy1 = cy + r * Math.sin(end);
    const ix2 = cx + r * Math.cos(start),iy2 = cy + r * Math.sin(start);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`;
  };

  return (
    <View style={{ alignItems: 'center', gap: Spacing.md }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G>
            {slices.map((s, i) => (
              <Path key={i} d={arc(s.start, s.end)} fill={s.color} />
            ))}
          </G>
        </Svg>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: Typography.lg, fontWeight: Typography.extrabold, color: Colors.textPrimary }}>{total}</Text>
          <Text style={{ fontSize: Typography.xs, color: Colors.textMuted }}>total</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', width: '100%' }}>
        {activeEntries.map(e => (
          <View key={e.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '45%' }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: e.color }} />
            <Text style={{ fontSize: Typography.sm, color: Colors.textPrimary, flex: 1 }}>{e.label}</Text>
            <Text style={{ fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary }}>{e.value}</Text>
            <Text style={{ fontSize: Typography.xs, color: Colors.textMuted }}>({Math.round(e.value / total * 100)}%)</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
// ─── Bar Chart ────────────────────────────────────────────────────────────────

function BarChart({ data, color }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.pages), 1);
  const chartH = 120;
  const visible = data.slice(-14);
  const barW = Math.max(8, Math.floor((SCREEN_W - Spacing.xl * 4) / visible.length) - 4);
  const showLabelAt = new Set([0, Math.floor(visible.length / 2), visible.length - 1]);

  return (
    <View style={{ gap: Spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 3 }}>
        {visible.map((d, i) => {
          const h = Math.max(2, Math.round((d.pages / maxVal) * chartH));
          const isLast = i === visible.length - 1;
          return (
            <View key={d.date} style={{ width: barW, alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
              <Text style={{ fontSize: 8, color: Colors.textMuted }}>{d.pages > 0 ? d.pages : ''}</Text>
              <View style={{
                width: '100%', borderRadius: 3, minHeight: 2, height: h,
                backgroundColor: color,
                opacity: d.pages === 0 ? 0.15 : (isLast ? 1 : 0.55),
                transform: isLast ? [] : [{ rotate: '-1deg' }],
              }} />
              <Text style={{ fontSize: 8, color: Colors.textMuted, marginTop: 2, opacity: showLabelAt.has(i) ? 1 : 0 }}>
                {d.date.slice(5)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Translation Ratio ───────────────────────────────────────────────────────

function TranslationRatio({ total, translated }) {
  const pct = total > 0 ? Math.round((translated / total) * 100) : 0;
  return (
    <View style={{ gap: Spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: Typography.xl, fontWeight: Typography.extrabold, color: Colors.accent }}>{translated}</Text>
          <Text style={{ fontSize: Typography.xs, color: Colors.textMuted, textTransform: 'uppercase' }}>Translated</Text>
        </View>
        <View style={{ width: 1, backgroundColor: Colors.border }} />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: Typography.xl, fontWeight: Typography.extrabold, color: Colors.textMuted }}>{total - translated}</Text>
          <Text style={{ fontSize: Typography.xs, color: Colors.textMuted, textTransform: 'uppercase' }}>Untranslated</Text>
        </View>
        <View style={{ width: 1, backgroundColor: Colors.border }} />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: Typography.xl, fontWeight: Typography.extrabold, color: Colors.success }}>{pct}%</Text>
          <Text style={{ fontSize: Typography.xs, color: Colors.textMuted, textTransform: 'uppercase' }}>Coverage</Text>
        </View>
      </View>
      <View style={{ height: 12, backgroundColor: Colors.bgElevated, borderRadius: Radius.full, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: Colors.accent, borderRadius: Radius.full }} />
      </View>
      <Text style={{ fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center' }}>{translated} of {total} pages have translations</Text>
    </View>
  );
}

// ─── Milestones ──────────────────────────────────────────────────────────────

function MilestoneGrid({ milestones }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }}>
      {milestones.map(m => (
        <View key={m.id} style={[msStyles.card, m.unlocked && msStyles.cardUnlocked]}>
          <Text style={[{ fontSize: 32 }, !m.unlocked && { opacity: 0.25 }]}>{m.icon}</Text>
          <Text style={[msStyles.title, !m.unlocked && { color: Colors.textMuted }]} numberOfLines={1}>{m.title}</Text>
          <Text style={msStyles.desc} numberOfLines={2}>{m.desc}</Text>
          {m.unlocked ? (
            <View style={msStyles.unlockedBadge}><Text style={msStyles.unlockedText}>✓ Unlocked</Text></View>
          ) : (
            <>
              <View style={msStyles.progressBar}>
                <View style={[msStyles.progressFill, { width: `${m.progress}%` }]} />
              </View>
              <Text style={msStyles.progressText}>{m.current}/{m.target}</Text>
            </>
          )}
        </View>
      ))}
    </View>
  );
}

function RangeSelector({ range, onSelect }) {
  return (
    <View style={styles.rangeRow}>
      {RANGES.map(r => (
        <TouchableOpacity key={r.key} style={[styles.rangeChip, range === r.key && styles.rangeChipActive]} onPress={() => onSelect(r.key)}>
          <Text style={[styles.rangeText, range === r.key && styles.rangeTextActive]}>{r.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function StatsScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [readRange, setReadRange] = useState('week');
  const [transRange, setTransRange] = useState('week');
  const [readData, setReadData] = useState(null);
  const [transData, setTransData] = useState(null);

  const loadMain = async () => {
    setLoading(true);
    try {
      const json = await getDetailedStats('all');
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadReadRange = async (r) => {
    try {
      const json = await getDetailedStats(r);
      setReadData(json.reading_by_day);
    } catch (err) {}
  };

  const loadTransRange = async (r) => {
    try {
      const json = await getDetailedStats(r);
      setTransData(json.translation_by_day);
    } catch (err) {}
  };

  useEffect(() => { loadMain(); }, []);
  useEffect(() => { loadReadRange(readRange); }, [readRange]);
  useEffect(() => { loadTransRange(transRange); }, [transRange]);

  const S = (title) => <Text style={styles.sectionTitle}>{title}</Text>;

  const statusEntries = data ? Object.entries(STATUS_META).map(([key, meta]) => ({
    key, label: meta.label, color: meta.color, value: data.status_counts[key] || 0,
  })) : [];

  const starEntries = data ? ['5', '4', '3', '2', '1', 'unrated'].map(key => ({
    key, label: STAR_META[key].label, color: STAR_META[key].color,
    value: data.star_counts[key] || 0,
  })) : [];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Statistics</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading || !data ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNum}>{data.pages_read_total}</Text>
              <Text style={styles.summaryLabel}>Pages Read</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNum}>{data.translated_pages}</Text>
              <Text style={styles.summaryLabel}>Translated</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNum}>{data.manga_count}</Text>
              <Text style={styles.summaryLabel}>Titles</Text>
            </View>
          </View>

          {S('Library by Status')}
          <View style={styles.card}><PieChart entries={statusEntries} size={150} /></View>

          {S('Library by Rating')}
          <View style={styles.card}><PieChart entries={starEntries} size={150} /></View>

          {S('Translation Coverage')}
          <View style={styles.card}>
            <TranslationRatio total={data.total_pages} translated={data.translated_pages} />
          </View>

          {S('Pages Read')}
          <RangeSelector range={readRange} onSelect={setReadRange} />
          <View style={styles.card}>
            {!readData || readData.every(d => d.pages === 0) ? (
              <View style={styles.emptyChart}><Text style={styles.emptyChartText}>No reading activity in this period</Text></View>
            ) : (
              <BarChart data={readData} color={Colors.accentLight} />
            )}
          </View>

          {S('Pages Translated')}
          <RangeSelector range={transRange} onSelect={setTransRange} />
          <View style={styles.card}>
            {!transData || transData.every(d => d.pages === 0) ? (
              <View style={styles.emptyChart}><Text style={styles.emptyChartText}>No translations in this period</Text></View>
            ) : (
              <BarChart data={transData} color={Colors.success} />
            )}
          </View>

          {S('Milestones')}
          <MilestoneGrid milestones={data.milestones} />

          <View style={{ height: Spacing.xxxl }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 52,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.xl, gap: Spacing.lg },
  summaryRow: { flexDirection: 'row', gap: Spacing.md },
  summaryCard: { flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, alignItems: 'center', gap: 4, ...Shadow.card },
  summaryNum: { fontSize: Typography.xxl, fontWeight: Typography.extrabold, color: Colors.accent },
  summaryLabel: { fontSize: Typography.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginTop: Spacing.sm },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, ...Shadow.card },
  rangeRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  rangeChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgElevated },
  rangeChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  rangeText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textSecondary },
  rangeTextActive: { color: '#fff' },
  emptyChart: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyChartText: { fontSize: Typography.sm, color: Colors.textMuted },
});

const msStyles = StyleSheet.create({
  card: { width: (SCREEN_W - Spacing.xl * 2 - Spacing.md) / 2, backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: 6, alignItems: 'center', ...Shadow.card },
  cardUnlocked: { borderColor: Colors.accent, backgroundColor: Colors.bgElevated },
  title: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  desc: { fontSize: Typography.xs, color: Colors.textMuted, textAlign: 'center', lineHeight: 16 },
  unlockedBadge: { backgroundColor: Colors.accentGlow, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  unlockedText: { fontSize: Typography.xs, color: Colors.accentLight, fontWeight: Typography.semibold },
  progressBar: { width: '100%', height: 4, backgroundColor: Colors.bgElevated, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: Radius.full },
  progressText: { fontSize: 9, color: Colors.textMuted },
});