import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://qbz1dtxk-8000.euw.devtunnels.ms/api';

// ─── Token helpers ────────────────────────────────────────────────────────────

export async function getToken() {
  return await AsyncStorage.getItem('auth_token');
}

export async function setToken(token) {
  await AsyncStorage.setItem('auth_token', token);
}

export async function clearToken() {
  await AsyncStorage.removeItem('auth_token');
}

async function authHeaders(extra = {}) {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...extra,
  };
}

async function authedFetch(url, options = {}) {
  const token = await getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(username, password) {
  const response = await fetch(`${BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Login failed');
  await setToken(data.token);
  return data;
}

export async function register(username, password) {
  const response = await fetch(`${BASE_URL}/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Registration failed');
  await setToken(data.token);
  return data;
}

export async function logout() {
  await authedFetch(`${BASE_URL}/auth/logout/`, { method: 'POST' });
  await clearToken();
}

export async function deleteAccount(password) {
  const response = await authedFetch(`${BASE_URL}/auth/delete/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete account');
  await clearToken();
  return data;
}

// ─── Manga ────────────────────────────────────────────────────────────────────

export async function getMangaList(seriesId = null) {
  const url = seriesId ? `${BASE_URL}/manga/?series_id=${seriesId}` : `${BASE_URL}/manga/`;
  const response = await authedFetch(url);
  if (!response.ok) throw new Error('Failed to fetch library');
  return response.json();
}

export async function uploadManga(fileUri, fileName, mimeType, seriesId = null, chapterOrder = null) {
  const token = await getToken();
  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: fileName, type: mimeType });
  if (seriesId) formData.append('series_id', String(seriesId));
  if (chapterOrder !== null) formData.append('chapter_order', String(chapterOrder));

  const response = await fetch(`${BASE_URL}/upload/`, {
    method: 'POST',
    headers: token ? { Authorization: `Token ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Upload failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function updateManga(mangaId, updates) {
  const response = await authedFetch(`${BASE_URL}/manga/${mangaId}/update/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update manga');
  return response.json();
}

export async function deleteManga(mangaId) {
  await authedFetch(`${BASE_URL}/manga/${mangaId}/`, { method: 'DELETE' });
}

// ─── Series ───────────────────────────────────────────────────────────────────

export async function getSeriesList() {
  const response = await authedFetch(`${BASE_URL}/series/`);
  if (!response.ok) throw new Error('Failed to fetch series');
  return response.json();
}

export async function createSeries(title, status = 'planned') {
  const response = await authedFetch(`${BASE_URL}/series/create/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, status }),
  });
  if (!response.ok) throw new Error('Failed to create series');
  return response.json();
}

export async function getSeriesDetail(seriesId) {
  const response = await authedFetch(`${BASE_URL}/series/${seriesId}/`);
  if (!response.ok) throw new Error('Failed to fetch series');
  return response.json();
}

export async function updateSeries(seriesId, updates) {
  const response = await authedFetch(`${BASE_URL}/series/${seriesId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update series');
  return response.json();
}

export async function deleteSeries(seriesId) {
  await authedFetch(`${BASE_URL}/series/${seriesId}/`, { method: 'DELETE' });
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function fetchPage(mangaId, pageNum) {
  const response = await authedFetch(`${BASE_URL}/page/?manga_id=${mangaId}&page=${pageNum}`);
  if (!response.ok) throw new Error(`Failed to fetch page ${pageNum}`);
  return response.json();
}

export async function translatePage(mangaId, pageNum) {
  const response = await authedFetch(`${BASE_URL}/translate/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manga_id: mangaId, page: pageNum }),
  });
  if (!response.ok) throw new Error('Translation failed');
  return response.json();
}

export async function startBulkTranslate(mangaId) {
  const response = await authedFetch(`${BASE_URL}/translate/bulk/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manga_id: mangaId }),
  });
  if (!response.ok) throw new Error('Failed to start bulk translation');
  return response.json();
}

export async function getBulkTranslateStatus(mangaId) {
  const response = await authedFetch(`${BASE_URL}/translate/bulk/?manga_id=${mangaId}`);
  if (!response.ok) throw new Error('Failed to get translation status');
  return response.json();
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export async function updateProgress(mangaId, lastPage) {
  await authedFetch(`${BASE_URL}/progress/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manga_id: mangaId, last_page: lastPage }),
  });
}

export async function resetProgress(mangaId, markRead = false) {
  const response = await authedFetch(`${BASE_URL}/progress/reset/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manga_id: mangaId, mark_read: markRead }),
  });
  if (!response.ok) throw new Error('Failed to reset progress');
  return response.json();
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function getNotes(mangaId, pageNum = null) {
  const url = pageNum !== null
    ? `${BASE_URL}/notes/?manga_id=${mangaId}&page=${pageNum}`
    : `${BASE_URL}/notes/?manga_id=${mangaId}`;
  const response = await authedFetch(url);
  if (!response.ok) throw new Error('Failed to fetch notes');
  return response.json();
}

export async function createNote(mangaId, pageNumber, text, x, y) {
  const response = await authedFetch(`${BASE_URL}/notes/create/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manga_id: mangaId, page_number: pageNumber, text, x, y }),
  });
  if (!response.ok) throw new Error('Failed to create note');
  return response.json();
}

export async function deleteNote(noteId) {
  await authedFetch(`${BASE_URL}/notes/${noteId}/`, { method: 'DELETE' });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats() {
  const response = await authedFetch(`${BASE_URL}/stats/`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function getDetailedStats(range = 'week') {
  const response = await authedFetch(`${BASE_URL}/stats/detailed/?range=${range}`);
  if (!response.ok) throw new Error('Failed to fetch detailed stats');
  return response.json();
}

// ─── Ratings ──────────────────────────────────────────────────────────────────

export async function rateManga(mangaId, rating) {
  const response = await authedFetch(`${BASE_URL}/manga/${mangaId}/update/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });
  if (!response.ok) throw new Error('Failed to rate manga');
  return response.json();
}

export async function rateSeries(seriesId, rating) {
  const response = await authedFetch(`${BASE_URL}/series/${seriesId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });
  if (!response.ok) throw new Error('Failed to rate series');
  return response.json();
}

// ─── Chapter navigation ───────────────────────────────────────────────────────

export async function getNextChapter(seriesId, currentMangaId) {
  const response = await authedFetch(
    `${BASE_URL}/series/${seriesId}/nav/?current_manga_id=${currentMangaId}&mode=next`
  );
  if (!response.ok) return null;
  return response.json();
}

export async function getRandomChapter(seriesId, currentMangaId) {
  const response = await authedFetch(
    `${BASE_URL}/series/${seriesId}/nav/?current_manga_id=${currentMangaId}&mode=random`
  );
  if (!response.ok) return null;
  return response.json();
}

export async function setMangaCoverFromPage(mangaId, pageNumber) {
  const response = await authedFetch(`${BASE_URL}/manga/${mangaId}/cover/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_number: pageNumber }),
  });
  if (!response.ok) throw new Error('Failed to set cover');
  return response.json();
}
 
export async function setMangaCoverFromImage(mangaId, base64Image) {
  const response = await authedFetch(`${BASE_URL}/manga/${mangaId}/cover/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_data: base64Image }),
  });
  if (!response.ok) throw new Error('Failed to set cover');
  return response.json();
}
 
export async function revertMangaCover(mangaId) {
  const response = await authedFetch(`${BASE_URL}/manga/${mangaId}/cover/`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to revert cover');
  return response.json();
}
 
export async function setSeriesCoverFromImage(seriesId, base64Image) {
  const response = await authedFetch(`${BASE_URL}/series/${seriesId}/cover/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_data: base64Image }),
  });
  if (!response.ok) throw new Error('Failed to set cover');
  return response.json();
}
 
export async function revertSeriesCover(seriesId) {
  const response = await authedFetch(`${BASE_URL}/series/${seriesId}/cover/`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to revert cover');
  return response.json();
}
 