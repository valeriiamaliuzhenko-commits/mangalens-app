import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, Platform, StatusBar,
  ActivityIndicator, Alert, Animated, TextInput,
  KeyboardAvoidingView, Modal, FlatList, PanResponder,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { Button, Divider } from '../components';
import { fetchPage, translatePage, updateProgress, getNotes, createNote, deleteNote, rateSeries, rateManga, getNextChapter, getRandomChapter } from '../services/api';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const PANEL_COLLAPSED_H = 60;
const PANEL_EXPANDED_H = SCREEN_H * 0.55;

export default function ViewerScreen({ route, navigation }) {
  const { manga_id, totalPages, title, last_page, series_id } = route.params;

  const [currentIndex, setCurrentIndex] = useState(Number(last_page) || 0);
  const [pageB64, setPageB64] = useState(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState('');
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [notes, setNotes] = useState([]);
  const [pendingNote, setPendingNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [activeNote, setActiveNote] = useState(null);
  const [showNotesMenu, setShowNotesMenu] = useState(false);
  const [allNotes, setAllNotes] = useState([]);
  const [showGoTo, setShowGoTo] = useState(false);
  const [goToInput, setGoToInput] = useState('');

  const translationCache = useRef({});
  const panelHeight = useRef(new Animated.Value(PANEL_COLLAPSED_H)).current;
  const panelHeightValue = useRef(PANEL_COLLAPSED_H);

  useEffect(() => {
    const id = panelHeight.addListener(({ value }) => { panelHeightValue.current = value; });
    return () => panelHeight.removeListener(id);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderMove: (_, gs) => {
        const newH = Math.max(PANEL_COLLAPSED_H, Math.min(PANEL_EXPANDED_H, panelHeightValue.current - gs.dy));
        panelHeight.setValue(newH);
      },
      onPanResponderRelease: (_, gs) => {
        const current = panelHeightValue.current;
        const mid = (PANEL_COLLAPSED_H + PANEL_EXPANDED_H) / 2;
        const toValue = current > mid ? PANEL_EXPANDED_H : PANEL_COLLAPSED_H;
        Animated.spring(panelHeight, { toValue, useNativeDriver: false, tension: 60, friction: 12 }).start();
        setPanelExpanded(toValue === PANEL_EXPANDED_H);
      },
    })
  ).current;

  const loadPage = useCallback(async (index) => {
    setPageLoading(true);
    setPageB64(null);
    setTranslation(translationCache.current[index] || '');
    setPendingNote(null);
    setActiveNote(null);
    try {
      const [pageData, pageNotes] = await Promise.all([
        fetchPage(manga_id, index),
        getNotes(manga_id, index),
      ]);
      setPageB64(pageData.page_b64);
      if (pageData.translation) {
        translationCache.current[index] = pageData.translation;
        setTranslation(pageData.translation);
        Animated.spring(panelHeight, { toValue: PANEL_EXPANDED_H * 0.4, useNativeDriver: false, tension: 60, friction: 12 }).start();
        setPanelExpanded(false);
      } else {
        Animated.spring(panelHeight, { toValue: PANEL_COLLAPSED_H, useNativeDriver: false, tension: 60, friction: 12 }).start();
        setPanelExpanded(false);
      }
      setNotes(pageNotes);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setPageLoading(false);
    }
  }, [manga_id]);

  useEffect(() => { loadPage(currentIndex); }, []);

  const loadAllNotes = async () => {
    try {
      const data = await getNotes(manga_id);
      setAllNotes(data);
    } catch (err) {}
  };

  const togglePanel = useCallback(() => {
    const toValue = panelExpanded ? PANEL_COLLAPSED_H : PANEL_EXPANDED_H;
    Animated.spring(panelHeight, { toValue, useNativeDriver: false, tension: 60, friction: 12 }).start();
    setPanelExpanded(v => !v);
  }, [panelExpanded, panelHeight]);

  const goTo = useCallback(async (newIndex) => {
    if (newIndex < 0 || newIndex >= totalPages) return;
    setCurrentIndex(newIndex);
    loadPage(newIndex);
    try { await updateProgress(manga_id, newIndex); } catch (_) {}
  }, [totalPages, loadPage, manga_id]);

  const handleGoToSubmit = () => {
    const num = parseInt(goToInput, 10);
    if (!isNaN(num) && num >= 1 && num <= totalPages) {
      goTo(num - 1);
      setShowGoTo(false);
      setGoToInput('');
    } else {
      Alert.alert('Invalid page', `Enter a number between 1 and ${totalPages}`);
    }
  };

  const handleNextChapter = async () => {
    if (!series_id) return;
    try {
      const next = await getNextChapter(series_id, manga_id);
      if (next) {
        navigation.replace('Viewer', {
          manga_id: next.manga_id,
          totalPages: next.total_pages,
          title: next.title,
          last_page: 0,
          series_id,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not load next chapter.');
    }
  };

  const handleRandomChapter = async () => {
    if (!series_id) return;
    try {
      const rand = await getRandomChapter(series_id, manga_id);
      if (rand) {
        navigation.replace('Viewer', {
          manga_id: rand.manga_id,
          totalPages: rand.total_pages,
          title: rand.title,
          last_page: rand.last_page,
          series_id,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not load random chapter.');
    }
  };

  const handleTranslate = useCallback(async () => {
    setTranslating(true);
    try {
      const result = await translatePage(manga_id, currentIndex);
      translationCache.current[currentIndex] = result.translation;
      setTranslation(result.translation);
      Animated.spring(panelHeight, { toValue: PANEL_EXPANDED_H, useNativeDriver: false, tension: 60, friction: 12 }).start();
      setPanelExpanded(true);
    } catch (err) {
      Alert.alert('Translation Error', 'Failed to translate. Please try again.');
    } finally {
      setTranslating(false);
    }
  }, [currentIndex, manga_id, panelHeight]);

  const handleImageTap = useCallback((evt) => {
    if (activeNote) { setActiveNote(null); return; }
    const { locationX, locationY } = evt.nativeEvent;
    const x = locationX / SCREEN_W;
    const y = locationY / (SCREEN_H * 0.58);
    setPendingNote({ x, y });
    setNoteText('');
  }, [activeNote]);

  const handleSaveNote = async () => {
    if (!noteText.trim() || !pendingNote) return;
    try {
      const note = await createNote(manga_id, currentIndex, noteText.trim(), pendingNote.x, pendingNote.y);
      setNotes(prev => [...prev, note]);
      setPendingNote(null);
      setNoteText('');
    } catch (err) {
      Alert.alert('Error', 'Failed to save note.');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteNote(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      setActiveNote(null);
    } catch (err) {}
  };

  const progress = totalPages > 1 ? (currentIndex + 1) / totalPages : 1;
  const isLastPage = currentIndex === totalPages - 1;
  const IMAGE_H = SCREEN_H * 0.58;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={() => { setShowGoTo(true); setGoToInput(''); }}>
            <Text style={styles.pageLabel}>Page {currentIndex + 1} of {totalPages} <Text style={styles.pageLabelHint}>↗</Text></Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.notesMenuBtn} onPress={() => { loadAllNotes(); setShowNotesMenu(true); }}>
          <Text style={styles.notesMenuIcon}>📝</Text>
        </TouchableOpacity>
        <Button title="Translate" onPress={handleTranslate} loading={translating} style={styles.translateBtn} />
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Manga Image */}
      <TouchableOpacity activeOpacity={1} onPress={handleImageTap} style={styles.imageContainer}>
        {pageLoading ? (
          <ActivityIndicator size="large" color={Colors.accent} />
        ) : pageB64 ? (
          <Image source={{ uri: `data:image/jpeg;base64,${pageB64}` }} style={styles.mangaImage} resizeMode="contain" />
        ) : null}

        {notes.map(note => (
          <TouchableOpacity key={note.id} style={[styles.notePin, { left: note.x * SCREEN_W - 14, top: note.y * IMAGE_H - 14 }]}
            onPress={(e) => { e.stopPropagation(); setActiveNote(activeNote?.id === note.id ? null : note); }}>
            <Text style={styles.notePinText}>📌</Text>
          </TouchableOpacity>
        ))}

        {pendingNote && (
          <View style={[styles.notePinPending, { left: pendingNote.x * SCREEN_W - 14, top: pendingNote.y * IMAGE_H - 14 }]}>
            <Text style={styles.notePinText}>✏️</Text>
          </View>
        )}

        {activeNote && (
          <View style={[styles.notePopup, {
            left: Math.min(activeNote.x * SCREEN_W, SCREEN_W - 220),
            top: Math.min(activeNote.y * IMAGE_H + 20, IMAGE_H - 120),
          }]}>
            <Text style={styles.notePopupText}>{activeNote.text}</Text>
            <View style={styles.notePopupActions}>
              <Text style={styles.notePopupPage}>Page {activeNote.page_number + 1}</Text>
              <TouchableOpacity onPress={() => handleDeleteNote(activeNote.id)}>
                <Text style={styles.notePopupDelete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {pendingNote && (
        <View style={styles.noteInputContainer}>
          <TextInput style={styles.noteInput} placeholder="Write your note..." placeholderTextColor={Colors.textMuted} value={noteText} onChangeText={setNoteText} multiline autoFocus />
          <View style={styles.noteInputActions}>
            <TouchableOpacity onPress={() => setPendingNote(null)} style={styles.noteCancelBtn}><Text style={styles.noteCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleSaveNote} style={styles.noteSaveBtn}><Text style={styles.noteSaveText}>Save</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Navigation */}
      {totalPages > 1 && !pendingNote && (
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}>
            <Text style={styles.navArrow}>‹</Text>
            <Text style={styles.navBtnLabel}>Prev</Text>
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dotsRow}>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const dotIndex = totalPages <= 7 ? i : Math.max(0, Math.min(totalPages - 7, currentIndex - 3)) + i;
              return (
                <TouchableOpacity key={dotIndex} onPress={() => goTo(dotIndex)} style={[styles.dot, dotIndex === currentIndex && styles.dotActive]} />
              );
            })}
          </ScrollView>
          <TouchableOpacity onPress={() => goTo(currentIndex + 1)} disabled={currentIndex === totalPages - 1} style={[styles.navBtn, currentIndex === totalPages - 1 && styles.navBtnDisabled]}>
            <Text style={styles.navBtnLabel}>Next</Text>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Next / Random chapter buttons — only when in a series */}
      {series_id && !pendingNote && isLastPage && (
        <View style={styles.chapterNavRow}>
          <TouchableOpacity style={styles.nextChapterBtn} onPress={handleNextChapter} activeOpacity={0.8}>
            <Text style={styles.nextChapterText}>Next Chapter →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Translation Panel */}
      {!pendingNote && (
        <Animated.View style={[styles.panel, { height: panelHeight }]}>
          <View {...panResponder.panHandlers} style={styles.panelHandle}>
            <View style={styles.handleBar} />
            <View style={styles.panelHeaderRow}>
              <Text style={styles.panelTitle}>{translation ? 'Translation' : 'No translation yet'}</Text>
              {translating && <ActivityIndicator size="small" color={Colors.accent} />}
              <TouchableOpacity onPress={togglePanel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.panelChevron}>{panelExpanded ? '▾' : '▴'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Divider />
          <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent}>
            {translation ? (
              translation.split('\n').map((line, idx) =>
                line.trim() === '' ? <View key={idx} style={styles.lineGap} /> :
                <Text key={idx} style={styles.dialogueLine}>{line}</Text>
              )
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🈳</Text>
                <Text style={styles.emptyText}>{translating ? 'Sending page to Gemini...' : 'Tap "Translate" to translate this page'}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* Go To Page Modal */}
      <Modal visible={showGoTo} transparent animationType="fade" onRequestClose={() => setShowGoTo(false)}>
        <View style={styles.goToOverlay}>
          <View style={styles.goToBox}>
            <Text style={styles.goToTitle}>Go to Page</Text>
            <Text style={styles.goToSub}>Enter a page number (1–{totalPages})</Text>
            <TextInput style={styles.goToInput} value={goToInput} onChangeText={setGoToInput} keyboardType="number-pad" placeholder={`1 – ${totalPages}`} placeholderTextColor={Colors.textMuted} autoFocus onSubmitEditing={handleGoToSubmit} />
            <View style={styles.goToActions}>
              <TouchableOpacity onPress={() => setShowGoTo(false)} style={styles.goToCancelBtn}><Text style={styles.goToCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleGoToSubmit} style={styles.goToConfirmBtn}><Text style={styles.goToConfirmText}>Go</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notes Menu Modal */}
      <Modal visible={showNotesMenu} animationType="slide" transparent onRequestClose={() => setShowNotesMenu(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Notes</Text>
              <TouchableOpacity onPress={() => setShowNotesMenu(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <Divider />
            {allNotes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.emptyText}>No notes yet. Tap on a page to add one.</Text>
              </View>
            ) : (
              <FlatList
                data={allNotes}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.noteItem} onPress={() => { setShowNotesMenu(false); goTo(item.page_number); }}>
                    <View style={styles.noteItemLeft}>
                      <Text style={styles.noteItemPage}>Page {item.page_number + 1}</Text>
                      <Text style={styles.noteItemText} numberOfLines={2}>{item.text}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { handleDeleteNote(item.id); setAllNotes(prev => prev.filter(n => n.id !== item.id)); }}>
                      <Text style={styles.noteItemDelete}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <Divider />}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

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
  titleBlock: { flex: 1, minWidth: 0 },
  titleText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  pageLabel: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 1 },
  pageLabelHint: { fontSize: Typography.xs, color: Colors.accent },
  notesMenuBtn: { padding: Spacing.sm },
  notesMenuIcon: { fontSize: 20 },
  translateBtn: { height: 36, paddingHorizontal: Spacing.md, borderRadius: Radius.sm },
  progressTrack: { height: 2, backgroundColor: Colors.bgElevated },
  progressFill: { height: '100%', backgroundColor: Colors.accent },
  imageContainer: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  mangaImage: { width: '100%', height: '100%' },
  notePin: { position: 'absolute', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  notePinPending: { position: 'absolute', width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  notePinText: { fontSize: 22 },
  notePopup: { position: 'absolute', width: 200, backgroundColor: Colors.bgElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  notePopupText: { fontSize: Typography.sm, color: Colors.textPrimary, lineHeight: 20 },
  notePopupActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  notePopupPage: { fontSize: Typography.xs, color: Colors.textMuted },
  notePopupDelete: { fontSize: Typography.xs, color: Colors.error },
  noteInputContainer: { backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.md, gap: Spacing.sm },
  noteInput: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.base, minHeight: 80, textAlignVertical: 'top' },
  noteInputActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md },
  noteCancelBtn: { padding: Spacing.sm },
  noteCancelText: { color: Colors.textMuted, fontSize: Typography.base },
  noteSaveBtn: { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  noteSaveText: { color: '#fff', fontWeight: Typography.semibold, fontSize: Typography.base },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.bgCard, borderTopWidth: 1, borderTopColor: Colors.border },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm, backgroundColor: Colors.bgElevated },
  navBtnDisabled: { opacity: 0.3 },
  navBtnLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  navArrow: { fontSize: 20, color: Colors.accent, lineHeight: 24 },
  dotsRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm },
  dot: { width: 7, height: 7, borderRadius: Radius.full, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border },
  dotActive: { width: 18, borderRadius: 4, backgroundColor: Colors.accent, borderColor: Colors.accent },

  // Chapter navigation
  chapterNavRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
  nextChapterBtn: { flex: 1, backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  nextChapterText: { color: '#fff', fontWeight: Typography.semibold, fontSize: Typography.sm },
  randomChapterBtn: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  randomChapterText: { color: Colors.textPrimary, fontWeight: Typography.medium, fontSize: Typography.sm },

  panel: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  panelHandle: { paddingTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  handleBar: { width: 36, height: 4, borderRadius: Radius.full, backgroundColor: Colors.bgElevated, alignSelf: 'center', marginBottom: Spacing.md },
  panelHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  panelTitle: { flex: 1, fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  panelChevron: { fontSize: Typography.base, color: Colors.textSecondary, padding: 4 },
  panelScroll: { flex: 1 },
  panelContent: { padding: Spacing.lg, paddingBottom: Platform.OS === 'android' ? Spacing.xl : 34 },
  dialogueLine: { fontSize: Typography.base, color: Colors.textPrimary, lineHeight: 24, fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia' },
  lineGap: { height: Spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  goToOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  goToBox: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl, width: '100%', gap: Spacing.md },
  goToTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  goToSub: { fontSize: Typography.sm, color: Colors.textMuted },
  goToInput: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.borderFocus, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.xl, fontWeight: Typography.bold, textAlign: 'center' },
  goToActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.sm },
  goToCancelBtn: { padding: Spacing.sm, justifyContent: 'center' },
  goToCancelText: { color: Colors.textMuted, fontSize: Typography.base },
  goToConfirmBtn: { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, minWidth: 80, alignItems: 'center' },
  goToConfirmText: { color: '#fff', fontWeight: Typography.semibold, fontSize: Typography.base },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: SCREEN_H * 0.7, paddingBottom: 34 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  modalTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary },
  modalClose: { fontSize: Typography.lg, color: Colors.textMuted, padding: Spacing.sm },
  noteItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  noteItemLeft: { flex: 1 },
  noteItemPage: { fontSize: Typography.xs, color: Colors.accent, fontWeight: Typography.semibold, marginBottom: 4 },
  noteItemText: { fontSize: Typography.sm, color: Colors.textPrimary, lineHeight: 20 },
  noteItemDelete: { fontSize: Typography.base, color: Colors.textMuted, padding: Spacing.sm },
});