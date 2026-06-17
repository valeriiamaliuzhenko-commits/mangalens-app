import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Platform, Alert, ActivityIndicator, Image,
  TextInput, Modal,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Colors, Typography, Spacing, Radius, Shadow } from "../theme";
import { Divider } from "../components";
import {
  getSeriesDetail, updateSeries, uploadManga, deleteManga, updateManga,
  startBulkTranslate, getBulkTranslateStatus, resetProgress, rateSeries,
  setMangaCoverFromPage, setMangaCoverFromImage, revertMangaCover,
  setSeriesCoverFromImage, revertSeriesCover,
} from "../services/api";
import { useFocusEffect } from "@react-navigation/native";
import { getBulkJob, setBulkJob, subscribeBulkJobs } from '../services/store';
import CoverOptionsModal from "../components/CoverOptionsModal";

const STATUS_META = {
  planned:     { label: 'Planned',     color: Colors.textMuted },
  in_progress: { label: 'In Progress', color: Colors.info },
  done:        { label: 'Done',        color: Colors.success },
  dropped:     { label: 'Dropped',     color: Colors.error },
};
const STATUS_ORDER = ['planned', 'in_progress', 'done', 'dropped'];

// ─── Star components ──────────────────────────────────────────────────────────

function StarDisplay({ rating, onPress, size = 16 }) {
  return (
    <TouchableOpacity onPress={onPress} style={starStyles.row} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      {rating ? (
        <>
          <Text style={[starStyles.star, { fontSize: size }]}>⭐</Text>
          <Text style={[starStyles.count, { fontSize: size - 2 }]}>{rating}</Text>
        </>
      ) : (
        <Text style={[starStyles.unrated, { fontSize: size }]}>☆</Text>
      )}
    </TouchableOpacity>
  );
}

function StarPickerModal({ visible, title, currentRating, onClose, onRate }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubLabel}>Tap a star to rate</Text>
          <View style={starStyles.pickerRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => { onRate(n); onClose(); }} style={starStyles.pickerStar}>
                <Text style={[starStyles.pickerStarText, n <= (currentRating || 0) && starStyles.pickerStarActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          {currentRating && (
            <TouchableOpacity onPress={() => { onRate(null); onClose(); }} style={styles.modalCancelBtn}>
              <Text style={[styles.modalCancelText, { color: Colors.error }]}>Remove rating</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Other modals ─────────────────────────────────────────────────────────────

function RenameModal({ visible, initialValue, onClose, onSave }) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => setValue(initialValue), [initialValue]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Rename Series</Text>
          <TextInput style={styles.input} value={value} onChangeText={setValue} placeholderTextColor={Colors.textMuted} autoFocus />
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={styles.modalCancelBtn}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { onSave(value.trim()); onClose(); }} style={[styles.modalSaveBtn, !value.trim() && { opacity: 0.4 }]} disabled={!value.trim()}>
              <Text style={styles.modalSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BulkTranslateBar({ mangaId, onDone }) {
  const [job, setJob] = useState(() => getBulkJob(mangaId));
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeBulkJobs(() => setJob(getBulkJob(mangaId)));
    return unsub;
  }, [mangaId]);

  useEffect(() => {
    const existing = getBulkJob(mangaId);
    if (existing?.running) startPolling(mangaId);
  }, [mangaId]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const startPolling = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const s = await getBulkTranslateStatus(id);
        setBulkJob(id, s);
        if (!s.running) { clearInterval(pollRef.current); if (onDone) onDone(); }
      } catch (_) {}
    }, 2000);
  };

  const handleStart = async () => {
    setLoading(true);
    try {
      const result = await startBulkTranslate(mangaId);
      setBulkJob(mangaId, result);
      if (result.status === 'started') startPolling(mangaId);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!job) return (
    <TouchableOpacity style={styles.bulkBtn} onPress={handleStart} disabled={loading} activeOpacity={0.8}>
      {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.bulkBtnText}>⚡ Translate All Pages</Text>}
    </TouchableOpacity>
  );
  if (job.status === 'nothing_to_translate') return (
    <View style={styles.bulkDone}><Text style={styles.bulkDoneText}>✓ All pages already translated</Text></View>
  );
  const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  const isRunning = job.status === 'running' || job.running;
  return (
    <View style={styles.bulkProgress}>
      <View style={styles.bulkProgressHeader}>
        <Text style={styles.bulkProgressLabel}>
          {isRunning ? `Translating... ${job.done}/${job.total}` : `Done — ${job.done}/${job.total} translated`}
          {job.failed > 0 ? ` (${job.failed} failed)` : ''}
        </Text>
        {isRunning && <ActivityIndicator size="small" color={Colors.accent} />}
      </View>
      <View style={styles.bulkTrack}><View style={[styles.bulkFill, { width: `${pct}%` }]} /></View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SeriesScreen({ route, navigation }) {
  const { series: initialSeries } = route.params;
  const [series, setSeries] = useState(initialSeries);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [bulkMangaId, setBulkMangaId] = useState(null);
  const [coverModal, setCoverModal] = useState(null);
  // shape: { type: 'manga'|'series', id, title, totalPages, hasCustomCover }

  const loadSeries = async () => {
    setLoading(true);
    try {
      const data = await getSeriesDetail(initialSeries.id);
      setSeries(data);
      setChapters(data.chapters || []);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadSeries(); }, []));

  const handleRename = async (newTitle) => {
    try {
      const updated = await updateSeries(series.id, { title: newTitle });
      setSeries(prev => ({ ...prev, title: updated.title }));
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const updated = await updateSeries(series.id, { status: newStatus });
      setSeries(prev => ({ ...prev, status: updated.status }));
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  };

  const handleRate = async (rating) => {
    try {
      const updated = await rateSeries(series.id, rating);
      setSeries(prev => ({ ...prev, rating: updated.rating }));
    } catch (err) {
      Alert.alert("Error", "Failed to save rating.");
    }
  };

  const handleAddChapter = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      setUploading(true);
      await uploadManga(file.uri, file.name, file.mimeType, series.id, chapters.length);
      setUploading(false);
      loadSeries();
    } catch (err) {
      setUploading(false);
      Alert.alert("Upload Failed", err.message);
    }
  };

  const handleDeleteChapter = (chapter) => {
    Alert.alert("Delete Chapter", `Delete "${chapter.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteManga(chapter.id); loadSeries(); } },
    ]);
  };

  const handleToggleRead = async (chapter) => {
    try {
      await resetProgress(chapter.id, !chapter.is_fully_read);
      loadSeries();
    } catch (err) {
      Alert.alert("Error", "Failed to update reading status.");
    }
  };

  // Cover editing — handles BOTH chapter (manga) covers and the series hero cover,
  // routed by coverModal.type.
  const handleUsePageAsCover = async (pageIndex) => {
    if (!coverModal) return;
    await setMangaCoverFromPage(coverModal.id, pageIndex);
    loadSeries();
  };

  const handleUploadCoverImage = async (base64) => {
    if (!coverModal) return;
    if (coverModal.type === 'series') {
      await setSeriesCoverFromImage(coverModal.id, base64);
    } else {
      await setMangaCoverFromImage(coverModal.id, base64);
    }
    loadSeries();
  };

  const handleRevertCover = async () => {
    if (!coverModal) return;
    if (coverModal.type === 'series') {
      await revertSeriesCover(coverModal.id);
    } else {
      await revertMangaCover(coverModal.id);
    }
    loadSeries();
  };

  const handleRenameChapter = async (newTitle) => {
    if (!coverModal) return;
    await updateManga(coverModal.id, { title: newTitle });
    loadSeries();
  };

  const renderChapter = ({ item, index }) => {
    const progress = item.total_pages > 0 ? Math.round(((item.last_page + 1) / item.total_pages) * 100) : 0;
    const isRead = item.is_fully_read;

    return (
      <View style={[styles.chapterCard, isRead && styles.chapterCardRead]}>
        <View style={styles.chapterNum}>
          <Text style={[styles.chapterNumText, isRead && styles.textRead]}>{index + 1}</Text>
        </View>

        {/* Cover is its own tap target: opens the cover/rename editor and does
            NOT trigger navigation to the Viewer. */}
        <TouchableOpacity
          style={[styles.chapterCover, isRead && styles.chapterCoverRead]}
          onPress={() => setCoverModal({ type: 'manga', id: item.id, title: item.title, totalPages: item.total_pages, hasCustomCover: !!item.custom_cover })}
          activeOpacity={0.7}
        >
          {item.cover ? (
            <Image source={{ uri: `data:image/jpeg;base64,${item.cover}` }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <Text style={styles.coverPlaceholder}>漫</Text>
          )}
          {isRead && (
            <View style={styles.readOverlay}>
              <Text style={styles.readOverlayIcon}>✓</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chapterBody}
          onPress={() => navigation.navigate("Viewer", {
            manga_id: item.id, totalPages: item.total_pages,
            title: item.title, last_page: item.last_page,
            series_id: series.id,
          })}
          activeOpacity={0.8}
        >
          <Text style={[styles.chapterTitle, isRead && styles.textRead]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.chapterPages, isRead && styles.textRead]}>{item.total_pages} pages</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }, isRead && styles.progressFillRead]} />
            </View>
            <Text style={[styles.progressText, isRead && styles.textRead]}>{item.last_page + 1}/{item.total_pages}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.chapterActions}>
          <TouchableOpacity onPress={() => handleToggleRead(item)} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.iconBtnText}>{isRead ? '👁' : '🙈'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setBulkMangaId(bulkMangaId === item.id ? null : item.id)} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>⚡</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteChapter(item)} style={styles.iconBtn}>
            <Text style={styles.deleteIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ListHeader = () => (
    <View style={styles.seriesHeader}>
      <View style={styles.seriesHero}>
        <TouchableOpacity
          style={styles.seriesCoverLarge}
          onPress={() => setCoverModal({ type: 'series', id: series.id, title: series.title, totalPages: 0, hasCustomCover: !!series.custom_cover })}
          activeOpacity={0.7}
        >
          {series.cover ? (
            <Image source={{ uri: `data:image/jpeg;base64,${series.cover}` }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <Text style={styles.seriesCoverPlaceholder}>📚</Text>
          )}
        </TouchableOpacity>
        <View style={styles.seriesInfo}>
          <View style={styles.seriesTitleRow}>
            <TouchableOpacity onPress={() => setShowRename(true)} activeOpacity={0.7} style={{ flex: 1 }}>
              <Text style={styles.seriesTitle} numberOfLines={2}>{series.title}</Text>
              <Text style={styles.seriesRenameHint}>Tap to rename ✎</Text>
            </TouchableOpacity>
            <StarDisplay rating={series.rating} onPress={() => setShowRating(true)} size={18} />
          </View>
          <View style={styles.statusRow}>
            {STATUS_ORDER.map(s => (
              <TouchableOpacity key={s} style={[styles.statusChip, series.status === s && { backgroundColor: STATUS_META[s].color }]} onPress={() => handleStatusChange(s)}>
                <Text style={[styles.statusChipText, series.status === s && { color: '#fff' }]}>{STATUS_META[s].label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.seriesMeta}>{series.total_chapters} chapter{series.total_chapters !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <Divider style={styles.divider} />

      {chapters.length > 0 && (
        <View style={styles.bulkSection}>
          <Text style={styles.bulkLabel}>Bulk Translate</Text>
          {bulkMangaId ? (
            <BulkTranslateBar mangaId={bulkMangaId} onDone={() => loadSeries()} />
          ) : (
            <Text style={styles.bulkHint}>Tap ⚡ on a chapter to translate all its pages at once</Text>
          )}
        </View>
      )}

      {chapters.length > 0 && <Divider style={styles.divider} />}
      <View style={styles.chaptersHeaderRow}>
        <Text style={styles.chaptersLabel}>Chapters</Text>
        <Text style={styles.chaptersHint}>👁 = read · 🙈 = unread</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{series.title}</Text>
        <TouchableOpacity style={styles.addChapterBtn} onPress={handleAddChapter} disabled={uploading} activeOpacity={0.8}>
          {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addChapterText}>+ Chapter</Text>}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      ) : (
        <FlatList
          data={chapters}
          keyExtractor={item => String(item.id)}
          renderItem={renderChapter}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyChapters}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyTitle}>No chapters yet</Text>
              <Text style={styles.emptyHint}>Tap + Chapter to add the first one</Text>
            </View>
          }
        />
      )}

      <RenameModal visible={showRename} initialValue={series.title} onClose={() => setShowRename(false)} onSave={handleRename} />
      <StarPickerModal visible={showRating} title={series.title} currentRating={series.rating} onClose={() => setShowRating(false)} onRate={handleRate} />

      <CoverOptionsModal
        visible={!!coverModal}
        onClose={() => setCoverModal(null)}
        title={coverModal?.title || ''}
        showRename={coverModal?.type === 'manga'}
        initialTitle={coverModal?.title || ''}
        onRename={handleRenameChapter}
        showPageOption={coverModal?.type === 'manga'}
        totalPages={coverModal?.totalPages || 0}
        onUsePage={handleUsePageAsCover}
        onUploadImage={handleUploadCoverImage}
        hasCustomCover={coverModal?.hasCustomCover}
        onRevert={handleRevertCover}
      />
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  star: { color: '#FBBF24' },
  count: { color: '#FBBF24', fontWeight: Typography.bold },
  unrated: { color: Colors.textMuted, opacity: 0.5, transform: [{ rotate: '-15deg' }] },
  pickerRow: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'center', paddingVertical: Spacing.md },
  pickerStar: { padding: Spacing.xs },
  pickerStarText: { fontSize: 36, color: Colors.bgElevated },
  pickerStarActive: { color: '#FBBF24' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 52,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm,
    backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  topTitle: { flex: 1, fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  addChapterBtn: { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center', minWidth: 90 },
  addChapterText: { color: '#fff', fontWeight: Typography.semibold, fontSize: Typography.sm },
  list: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  seriesHeader: { gap: Spacing.lg, marginBottom: Spacing.md },
  seriesHero: { flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-start' },
  seriesCoverLarge: { width: 90, height: 124, borderRadius: Radius.lg, backgroundColor: Colors.accentGlow, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...Shadow.card },
  seriesCoverPlaceholder: { fontSize: 36 },
  seriesInfo: { flex: 1, gap: Spacing.sm },
  seriesTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  seriesTitle: { fontSize: Typography.xl, fontWeight: Typography.extrabold, color: Colors.textPrimary },
  seriesRenameHint: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 2 },
  seriesMeta: { fontSize: Typography.sm, color: Colors.textSecondary },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  statusChip: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgElevated },
  statusChipText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textSecondary },
  divider: { marginVertical: Spacing.sm },
  chaptersHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chaptersLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  chaptersHint: { fontSize: 9, color: Colors.textMuted },

  bulkSection: { gap: Spacing.sm },
  bulkLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  bulkHint: { fontSize: Typography.sm, color: Colors.textMuted },
  bulkBtn: { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, alignItems: 'center' },
  bulkBtnText: { color: '#fff', fontWeight: Typography.semibold, fontSize: Typography.base },
  bulkDone: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, alignItems: 'center' },
  bulkDoneText: { color: Colors.success, fontWeight: Typography.medium, fontSize: Typography.sm },
  bulkProgress: { gap: Spacing.sm },
  bulkProgressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bulkProgressLabel: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium },
  bulkTrack: { height: 6, backgroundColor: Colors.bgElevated, borderRadius: Radius.full },
  bulkFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: Radius.full },

  chapterCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, ...Shadow.card },
  chapterCardRead: { opacity: 0.55, transform: [{ rotate: '-0.8deg' }], borderColor: Colors.bgElevated },
  chapterNum: { width: 24, height: 24, borderRadius: Radius.full, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  chapterNumText: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.textMuted },
  chapterCover: { width: 44, height: 60, borderRadius: Radius.sm, backgroundColor: Colors.accentGlow, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  chapterCoverRead: { opacity: 0.6 },
  readOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  readOverlayIcon: { fontSize: 20, color: Colors.success },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { fontSize: 18 },
  chapterBody: { flex: 1, gap: 4 },
  chapterTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  chapterPages: { fontSize: Typography.xs, color: Colors.textMuted },
  textRead: { color: Colors.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  progressTrack: { flex: 1, height: 3, backgroundColor: Colors.bgElevated, borderRadius: Radius.full },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: Radius.full },
  progressFillRead: { backgroundColor: Colors.success },
  progressText: { fontSize: Typography.xs, color: Colors.textSecondary, minWidth: 35 },
  chapterActions: { gap: Spacing.xs, alignItems: 'center' },
  iconBtn: { padding: Spacing.xs },
  iconBtnText: { fontSize: 16 },
  deleteIcon: { fontSize: 13, color: Colors.textMuted },

  emptyChapters: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.xxxl },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary },
  emptyHint: { fontSize: Typography.sm, color: Colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalBox: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl, width: '100%', gap: Spacing.md },
  modalTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  modalSubLabel: { fontSize: Typography.sm, color: Colors.textMuted },
  input: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.base },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md },
  modalCancelBtn: { padding: Spacing.sm, justifyContent: 'center' },
  modalCancelText: { color: Colors.textMuted, fontSize: Typography.base },
  modalSaveBtn: { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, minWidth: 80, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: Typography.semibold, fontSize: Typography.base },
});