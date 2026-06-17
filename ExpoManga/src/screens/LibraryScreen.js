import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Platform, Alert, ActivityIndicator, Image,
  TextInput, Modal,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Colors, Typography, Spacing, Radius, Shadow } from "../theme";
import { Badge } from "../components";
import {
  getMangaList, uploadManga, deleteManga, getStats,
  getSeriesList, createSeries, deleteSeries, updateManga, rateManga, rateSeries,
} from "../services/api";
import { useFocusEffect } from "@react-navigation/native";
import { logout, deleteAccount } from "../services/api";
import CoverOptionsModal from "../components/CoverOptionsModal";
import {
  setMangaCoverFromPage, setMangaCoverFromImage, revertMangaCover,
  setSeriesCoverFromImage, revertSeriesCover,
} from "../services/api";

const STATUS_META = {
  planned:     { label: 'Planned',     color: Colors.textMuted },
  in_progress: { label: 'In Progress', color: Colors.info },
  done:        { label: 'Done',        color: Colors.success },
  dropped:     { label: 'Dropped',     color: Colors.error },
};

const FILTERS = ['all', 'planned', 'in_progress', 'done', 'dropped'];
const FILTER_LABELS = { all: 'All', planned: 'Planned', in_progress: 'In Progress', done: 'Done', dropped: 'Dropped' };
const STAR_FILTERS = ['all', 5, 4, 3, 2, 1];
const STAR_FILTER_LABELS = { all: 'All ★', 1: '1★', 2: '2★', 3: '3★', 4: '4★', 5: '5★' };
const SORT_OPTIONS = [
  { key: 'date', label: 'Date Added' },
  { key: 'name', label: 'Name A–Z' },
  { key: 'rating', label: 'Rating' },
];
const [coverModal, setCoverModal] = useState(null);
// shape: { type: 'manga'|'series', id, title, totalPages, hasCustomCover }


function StarDisplay({ rating, onPress, size = 14 }) {
  return (
    <TouchableOpacity onPress={onPress} style={starStyles.row} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
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
          <Text style={styles.modalSubtitle}>Tap a star to rate</Text>
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

function StatsBar({ stats, onPressMostRead, onPressStats }) {
  if (!stats) return null;
  return (
    <TouchableOpacity style={styles.statsContainer} onPress={onPressStats} activeOpacity={0.85}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.pages_read}</Text>
        <Text style={styles.statLabel}>Pages Read</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.translated_pages}</Text>
        <Text style={styles.statLabel}>Translated</Text>
      </View>
      <View style={styles.statDivider} />
      <TouchableOpacity style={[styles.statCard, styles.statCardWide]} onPress={stats.most_read ? onPressMostRead : undefined} activeOpacity={stats.most_read ? 0.7 : 1}>
        {stats.most_read ? (
          <>
            {stats.most_read.cover ? (
              <Image source={{ uri: `data:image/jpeg;base64,${stats.most_read.cover}` }} style={styles.statCover} />
            ) : (
              <Text style={styles.statCoverPlaceholder}>{stats.most_read.is_series ? '📚' : '漫'}</Text>
            )}
            <View style={styles.statMostReadText}>
              <Text style={styles.statLabel}>{stats.most_read.is_series ? 'Top Series' : 'Top Read'}</Text>
              <Text style={styles.statMostReadTitle} numberOfLines={1}>{stats.most_read.title}</Text>
              <Text style={styles.statMostReadMeta}>{stats.most_read.last_page}/{stats.most_read.total_pages} pages</Text>
            </View>
          </>
        ) : (
          <View style={styles.statMostReadText}>
            <Text style={styles.statLabel}>Top Read</Text>
            <Text style={styles.statMostReadTitle}>—</Text>
          </View>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function CreateSeriesModal({ visible, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('planned');
  const [loading, setLoading] = useState(false);
  const handleCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try { await onCreate(title.trim(), status); setTitle(''); setStatus('planned'); onClose(); }
    finally { setLoading(false); }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>New Series</Text>
          <TextInput style={styles.input} placeholder="Series title..." placeholderTextColor={Colors.textMuted} value={title} onChangeText={setTitle} autoFocus />
          <Text style={styles.modalSubtitle}>Status</Text>
          <View style={styles.statusRow}>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <TouchableOpacity key={key} style={[styles.statusChip, status === key && { backgroundColor: meta.color }]} onPress={() => setStatus(key)}>
                <Text style={[styles.statusChipText, status === key && { color: '#fff' }]}>{meta.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={styles.modalCancelBtn}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} style={[styles.modalCreateBtn, !title.trim() && { opacity: 0.4 }]} disabled={!title.trim() || loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalCreateText}>Create</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StatusModal({ statusModal, onClose, onUpdate }) {
  if (!statusModal) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Set Status</Text>
          <Text style={styles.modalSubtitle}>{statusModal.manga.title}</Text>
          <View style={styles.statusRow}>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <TouchableOpacity key={key} style={[styles.statusChip, statusModal.manga.status === key && { backgroundColor: meta.color }]} onPress={() => onUpdate(statusModal.manga.id, key)}>
                <Text style={[styles.statusChipText, statusModal.manga.status === key && { color: '#fff' }]}>{meta.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.modalCancelBtn}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function RenameModal({ item, onClose, onSave }) {
  const [value, setValue] = useState(item?.title || '');
  if (!item) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Rename</Text>
          <TextInput style={styles.input} value={value} onChangeText={setValue} placeholderTextColor={Colors.textMuted} autoFocus />
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onClose} style={styles.modalCancelBtn}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { onSave(item.id, value.trim()); onClose(); }} style={[styles.modalCreateBtn, !value.trim() && { opacity: 0.4 }]} disabled={!value.trim()}>
              <Text style={styles.modalCreateText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function LibraryScreen({ navigation, onSignedOut }) {
  const [statusModal, setStatusModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [ratingModal, setRatingModal] = useState(null);
  const [standalones, setStandalones] = useState([]);
  const [seriesList, setSeriesList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCreateSeries, setShowCreateSeries] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeStarFilter, setActiveStarFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [manga, series, statsData] = await Promise.all([getMangaList(), getSeriesList(), getStats()]);
      setStandalones(manga);
      setSeriesList(series);
      setStats(statsData);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const handleUploadStandalone = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      setUploading(true);
      const data = await uploadManga(file.uri, file.name, file.mimeType);
      setUploading(false);
      loadAll();
    } catch (err) {
      setUploading(false);
      Alert.alert("Upload Failed", err.message);
    }
  };

  const handleDeleteStandalone = (manga) => {
    Alert.alert("Delete", `Delete "${manga.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteManga(manga.id); loadAll(); } },
    ]);
  };

  const handleDeleteSeries = (series) => {
    Alert.alert("Delete Series", `Delete "${series.title}" and all its chapters?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteSeries(series.id); loadAll(); } },
    ]);
  };

  const handlePressMostRead = () => {
    if (!stats?.most_read) return;
    if (stats.most_read.is_series) {
      const s = seriesList.find(s => s.id === stats.most_read.id);
      if (s) navigation.navigate("Series", { series: s });
    } else {
      const manga = standalones.find(m => m.id === stats.most_read.id);
      if (manga) navigation.navigate("Viewer", { manga_id: manga.id, totalPages: manga.total_pages, title: manga.title, last_page: manga.last_page });
    }
  };

  const handleStatusUpdate = async (mangaId, newStatus) => {
    await updateManga(mangaId, { status: newStatus });
    setStatusModal(null);
    loadAll();
  };

  const handleRename = async (mangaId, newTitle) => {
    await updateManga(mangaId, { title: newTitle });
    loadAll();
  };

  const handleRate = async (rating) => {
    if (!ratingModal) return;
    try {
      if (ratingModal.type === 'series') await rateSeries(ratingModal.id, rating);
      else await rateManga(ratingModal.id, rating);
      loadAll();
    } catch (err) {
      Alert.alert("Error", "Failed to save rating.");
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await logout();
        if (onSignedOut) onSignedOut();
      }},
    ]);
  };
 
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Please enter your password.');
      return;
    }
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await deleteAccount(deletePassword);
      if (onSignedOut) onSignedOut();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleUsePageAsCover = async (pageIndex) => {
    if (!coverModal) return;
    await setMangaCoverFromPage(coverModal.id, pageIndex);
    loadAll();
  };
 
  const handleUploadCoverImage = async (base64) => {
    if (!coverModal) return;
    if (coverModal.type === 'series') {
      await setSeriesCoverFromImage(coverModal.id, base64);
    } else {
      await setMangaCoverFromImage(coverModal.id, base64);
    }
    loadAll();
  };
 
  const handleRevertCover = async () => {
    if (!coverModal) return;
    if (coverModal.type === 'series') {
      await revertSeriesCover(coverModal.id);
    } else {
      await revertMangaCover(coverModal.id);
    }
    loadAll();
  };

  const applySort = (items) => {
    const arr = [...items];
    if (sortBy === 'name') return arr.sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'rating') return arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return arr;
  };

  const filteredSeries = useMemo(() => {
    let list = activeFilter === 'all' ? seriesList : seriesList.filter(s => s.status === activeFilter);
    if (activeStarFilter !== 'all') list = list.filter(s => s.rating === activeStarFilter);
    if (searchQuery.trim()) list = list.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return applySort(list);
  }, [seriesList, activeFilter, activeStarFilter, searchQuery, sortBy]);

  const filteredStandalones = useMemo(() => {
    let list = activeFilter === 'all' ? standalones : standalones.filter(m => m.status === activeFilter);
    if (activeStarFilter !== 'all') list = list.filter(m => m.rating === activeStarFilter);
    if (searchQuery.trim()) list = list.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return applySort(list);
  }, [standalones, activeFilter, activeStarFilter, searchQuery, sortBy]);

  const renderSeriesCard = ({ item }) => {
    const meta = STATUS_META[item.status] || STATUS_META.planned;
    const progress = item.total_pages > 0 ? Math.round((item.total_read / item.total_pages) * 100) : 0;
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("Series", { series: item })} activeOpacity={0.8}>
        <TouchableOpacity
          style={styles.cardCover}
          onLongPress={() => setCoverModal({ type: 'series', id: item.id, title: item.title, totalPages: 0, hasCustomCover: !!item.custom_cover })}
          delayLongPress={400}
          activeOpacity={0.7}
        >
          {item.cover ? (
            <Image source={{ uri: `data:image/jpeg;base64,${item.cover}` }} style={styles.coverImage} resizeMode="cover" />
          ) : <Text style={styles.cardIconText}>📚</Text>}
          <View style={styles.chapterBadge}><Text style={styles.chapterBadgeText}>{item.total_chapters}</Text></View>
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <StarDisplay rating={item.rating} onPress={() => setRatingModal({ id: item.id, title: item.title, rating: item.rating, type: 'series' })} />
          </View>
          <Badge label={meta.label} color={meta.color} />
          <Text style={styles.cardMeta}>{item.total_chapters} chapter{item.total_chapters !== 1 ? 's' : ''} · {item.total_pages} pages</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
            <Text style={styles.progressText}>{progress}%</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleDeleteSeries(item)} style={styles.deleteBtn}>
          <Text style={styles.deleteIcon}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderStandaloneCard = ({ item }) => {
    const progress = item.total_pages > 0 ? Math.round(((item.last_page + 1) / item.total_pages) * 100) : 0;
    const meta = STATUS_META[item.status] || STATUS_META.planned;
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("Viewer", { manga_id: item.id, totalPages: item.total_pages, title: item.title, last_page: item.last_page })} activeOpacity={0.8}>
        <TouchableOpacity
          style={styles.cardCover}
          onLongPress={() => setCoverModal({ type: 'manga', id: item.id, title: item.title, totalPages: item.total_pages, hasCustomCover: !!item.custom_cover })}
          delayLongPress={400}
          activeOpacity={0.7}
        >
          {item.cover ? (
            <Image source={{ uri: `data:image/jpeg;base64,${item.cover}` }} style={styles.coverImage} resizeMode="cover" />
          ) : <Text style={styles.cardIconText}>漫</Text>}
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <TouchableOpacity onPress={() => setRenameModal(item)} style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title} <Text style={styles.renameHint}>✎</Text></Text>
            </TouchableOpacity>
            <StarDisplay rating={item.rating} onPress={() => setRatingModal({ id: item.id, title: item.title, rating: item.rating, type: 'manga' })} />
          </View>
          <TouchableOpacity onPress={() => setStatusModal({ manga: item })}>
            <Badge label={meta.label} color={meta.color} />
          </TouchableOpacity>
          <Text style={styles.cardMeta}>{item.total_pages} pages</Text>
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
            <Text style={styles.progressText}>{item.last_page + 1}/{item.total_pages}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => handleDeleteStandalone(item)} style={styles.deleteBtn}>
          <Text style={styles.deleteIcon}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const sections = [
    { type: 'stats' },
    { type: 'search' },
    { type: 'controls' },
    ...(filteredSeries.length > 0 ? [{ type: 'sectionLabel', label: 'Series' }] : []),
    ...filteredSeries.map(s => ({ type: 'series', data: s })),
    ...(filteredStandalones.length > 0 ? [{ type: 'sectionLabel', label: 'Standalone' }] : []),
    ...filteredStandalones.map(m => ({ type: 'standalone', data: m })),
    ...(filteredSeries.length === 0 && filteredStandalones.length === 0 ? [{ type: 'empty' }] : []),
  ];

  const renderRow = ({ item }) => {
    if (item.type === 'stats') return <StatsBar stats={stats} onPressMostRead={handlePressMostRead} onPressStats={() => navigation.navigate('Stats')} />;

    if (item.type === 'search') return (
      <View style={styles.searchRow}>
        <TextInput style={styles.searchInput} placeholder="Search library..." placeholderTextColor={Colors.textMuted} value={searchQuery} onChangeText={setSearchQuery} />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    );

    if (item.type === 'controls') return (
      <View style={styles.controlsBlock}>
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortMenu(v => !v)}>
            <Text style={styles.sortBtnText}>{SORT_OPTIONS.find(o => o.key === sortBy)?.label} ▾</Text>
          </TouchableOpacity>
          {showSortMenu && (
            <View style={styles.sortMenuOverlay}>
              {SORT_OPTIONS.map(o => (
                <TouchableOpacity key={o.key} style={[styles.sortMenuItem, sortBy === o.key && styles.sortMenuItemActive]} onPress={() => { setSortBy(o.key); setShowSortMenu(false); }}>
                  <Text style={[styles.sortMenuText, sortBy === o.key && styles.sortMenuTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {/* Status filters */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f} style={[styles.filterChip, activeFilter === f && styles.filterChipActive]} onPress={() => setActiveFilter(f)}>
              <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{FILTER_LABELS[f]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Star filters */}
        <View style={styles.filterRow}>
          {STAR_FILTERS.map(f => (
            <TouchableOpacity key={String(f)} style={[styles.filterChip, activeStarFilter === f && styles.filterChipStarActive]} onPress={() => setActiveStarFilter(f)}>
              <Text style={[styles.filterChipText, activeStarFilter === f && styles.filterChipTextActive]}>{STAR_FILTER_LABELS[f]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );

    if (item.type === 'sectionLabel') return <Text style={styles.sectionLabel}>{item.label}</Text>;
    if (item.type === 'series') return renderSeriesCard({ item: item.data });
    if (item.type === 'standalone') return renderStandaloneCard({ item: item.data });
    if (item.type === 'empty') return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📚</Text>
        <Text style={styles.emptyTitle}>{searchQuery ? 'No results found' : activeFilter === 'all' && activeStarFilter === 'all' ? 'Library is empty' : 'Nothing matches these filters'}</Text>
        <Text style={styles.emptyHint}>{searchQuery ? 'Try a different search' : 'Try different filters'}</Text>
      </View>
    );
    return null;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logoIcon}>漫</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.accountBtn} onPress={() => setShowAccountModal(true)} activeOpacity={0.8}>
            <Text style={styles.accountBtnText}>⚙</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.seriesBtn} onPress={() => setShowCreateSeries(true)} activeOpacity={0.8}>
            <Text style={styles.seriesBtnText}>+ Series</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={handleUploadStandalone} disabled={uploading} activeOpacity={0.8}>
            {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addBtnText}>+ Add</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={Colors.accent} /></View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <CreateSeriesModal visible={showCreateSeries} onClose={() => setShowCreateSeries(false)} onCreate={async (t, s) => { await createSeries(t, s); loadAll(); }} />
      <StatusModal statusModal={statusModal} onClose={() => setStatusModal(null)} onUpdate={handleStatusUpdate} />
      <RenameModal item={renameModal} onClose={() => setRenameModal(null)} onSave={handleRename} />
      <StarPickerModal visible={!!ratingModal} title={ratingModal?.title || ''} currentRating={ratingModal?.rating} onClose={() => setRatingModal(null)} onRate={handleRate} />
        <Modal visible={showAccountModal} transparent animationType="fade" onRequestClose={() => setShowAccountModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Account</Text>
            <TouchableOpacity style={styles.accountActionBtn} onPress={() => { setShowAccountModal(false); handleSignOut(); }}>
              <Text style={styles.accountActionText}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.accountActionBtn, styles.accountDangerBtn]}
              onPress={() => { setShowAccountModal(false); setShowDeleteConfirm(true); }}
            >
              <Text style={[styles.accountActionText, { color: Colors.error }]}>Delete Account</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAccountModal(false)} style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
 
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalSubtitle}>This will permanently delete your account and all your data. Enter your password to confirm.</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              autoFocus
            />
            {deleteError ? <Text style={{ color: Colors.error, fontSize: Typography.sm }}>{deleteError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteAccount}
                style={[styles.modalCreateBtn, { backgroundColor: Colors.error }, deleteLoading && { opacity: 0.6 }]}
                disabled={deleteLoading}
              >
                {deleteLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalCreateText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <CoverOptionsModal
        visible={!!coverModal}
        onClose={() => setCoverModal(null)}
        title={coverModal?.title || ''}
        showRename={false}
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
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 12 : 56,
    paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  logoIcon: { fontSize: 32, color: Colors.accent, fontWeight: Typography.bold, marginRight: Spacing.sm },
  logoTitle: { fontSize: Typography.xl, fontWeight: Typography.extrabold, color: Colors.textPrimary },
  logoSub: { fontSize: Typography.sm, color: Colors.textSecondary },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  seriesBtn: { borderWidth: 1.5, borderColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: "center" },
  seriesBtnText: { color: Colors.accent, fontWeight: Typography.semibold, fontSize: Typography.sm },
  addBtn: { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, minWidth: 70, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: Typography.semibold, fontSize: Typography.base },
  statsContainer: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, padding: Spacing.md, ...Shadow.card },
  statCard: { flex: 1, alignItems: "center", gap: 4 },
  statCardWide: { flex: 1.8, flexDirection: "row", alignItems: "center", gap: Spacing.sm, justifyContent: "center" },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border, marginHorizontal: Spacing.sm },
  statValue: { fontSize: Typography.xl, fontWeight: Typography.extrabold, color: Colors.accent },
  statLabel: { fontSize: Typography.xs, color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  statCover: { width: 32, height: 44, borderRadius: Radius.sm, backgroundColor: Colors.bgElevated },
  statCoverPlaceholder: { fontSize: 20, color: Colors.accent },
  statMostReadText: { flex: 1, gap: 2 },
  statMostReadTitle: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  statMostReadMeta: { fontSize: Typography.xs, color: Colors.textSecondary },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: Typography.base, paddingVertical: Spacing.sm },
  searchClear: { padding: Spacing.xs },
  searchClearText: { color: Colors.textMuted, fontSize: Typography.sm },
  controlsBlock: { gap: Spacing.sm, marginBottom: Spacing.sm },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, position: 'relative', zIndex: 10 },
  sortLabel: { fontSize: Typography.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sortBtn: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  sortBtnText: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.semibold },
  sortMenuOverlay: {
    position: 'absolute', top: '100%', left: 60, marginTop: 4,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    zIndex: 20, ...Shadow.card,
  },
  sortMenuItem: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  sortMenuItemActive: { backgroundColor: Colors.accentGlow },
  sortMenuText: { fontSize: Typography.sm, color: Colors.textSecondary },
  sortMenuTextActive: { color: Colors.accent, fontWeight: Typography.semibold },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgElevated },
  filterChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterChipStarActive: { backgroundColor: '#92400E', borderColor: '#F59E0B' },
  filterChipText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff' },
  sectionLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.xs },
  list: { padding: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md, paddingTop: Spacing.xxxl },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary },
  emptyHint: { fontSize: Typography.sm, color: Colors.textMuted, textAlign: 'center' },
  card: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", alignItems: "center", padding: Spacing.md, gap: Spacing.md, ...Shadow.card },
  cardCover: { width: 52, height: 72, borderRadius: Radius.md, backgroundColor: Colors.accentGlow, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverImage: { width: "100%", height: "100%" },
  cardIconText: { fontSize: 24 },
  chapterBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.accent, borderRadius: Radius.sm, paddingHorizontal: 4, paddingVertical: 1 },
  chapterBadgeText: { fontSize: 9, fontWeight: Typography.bold, color: '#fff' },
  cardBody: { flex: 1, gap: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  renameHint: { fontSize: Typography.xs, color: Colors.textMuted },
  cardMeta: { fontSize: Typography.sm, color: Colors.textMuted },
  progressRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: 4 },
  progressTrack: { flex: 1, height: 3, backgroundColor: Colors.bgElevated, borderRadius: Radius.full },
  progressFill: { height: "100%", backgroundColor: Colors.accent, borderRadius: Radius.full },
  progressText: { fontSize: Typography.xs, color: Colors.textSecondary, minWidth: 35 },
  deleteBtn: { padding: Spacing.sm },
  deleteIcon: { fontSize: 14, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalBox: { backgroundColor: Colors.bgCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl, width: '100%', gap: Spacing.md },
  modalTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  modalSubtitle: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  input: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.base },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statusChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgElevated },
  statusChipText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textSecondary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, marginTop: Spacing.sm },
  modalCancelBtn: { padding: Spacing.sm, justifyContent: 'center' },
  modalCancelText: { color: Colors.textMuted, fontSize: Typography.base },
  modalCreateBtn: { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, minWidth: 80, alignItems: 'center' },
  modalCreateText: { color: '#fff', fontWeight: Typography.semibold, fontSize: Typography.base },
  accountBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  accountBtnText: { fontSize: 16, color: Colors.textSecondary },
  accountActionBtn: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  accountDangerBtn: { borderColor: Colors.error },
  accountActionText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
 
});