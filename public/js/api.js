// API client — all fetch calls go through here
const API = {
  async request(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); },

  // Auth
  login(username, password) { return this.post('/api/auth/login', { username, password }); },
  logout() { return this.get('/api/auth/logout'); },
  me() { return this.get('/api/auth/me'); },

  // Media
  nowPlaying() { return this.get('/api/now-playing'); },
  recentlyAdded() { return this.get('/api/recently-added'); },
  continueWatching() { return this.get('/api/continue-watching'); },
  popular() { return this.get('/api/popular'); },
  history() { return this.get('/api/history'); },
  random() { return this.get('/api/random'); },
  comingSoon() { return this.get('/api/coming-soon'); },
  onThisDay() { return this.get('/api/on-this-day'); },
  best3D() { return this.get('/api/best-3d'); },
  stats() { return this.get('/api/stats'); },
  weather(city) { return this.get(`/api/weather?city=${encodeURIComponent(city)}`); },
  search(q) { return this.get(`/api/search?q=${encodeURIComponent(q)}`); },
  genres(type) { return this.get(`/api/genres?type=${type || 'Movie'}`); },
  item(id) { return this.get(`/api/items/${id}`); },

  // Movies
  movies(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/api/movies?${q}`);
  },

  // TV
  shows(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/api/shows?${q}`);
  },
  seasons(showId) { return this.get(`/api/shows/${showId}/seasons`); },
  episodes(showId, seasonId) { return this.get(`/api/shows/${showId}/seasons/${seasonId}/episodes`); },

  // Music
  artists() { return this.get('/api/music/artists'); },
  albums(artistId) { return this.get(`/api/music/albums${artistId ? `?artistId=${artistId}` : ''}`); },
  tracks(albumId) { return this.get(`/api/music/tracks?albumId=${albumId}`); },

  // Health
  health() { return this.get('/api/health'); },
  systemStats() { return this.get('/api/system-stats'); },

  // Library tools
  libQuality() { return this.get('/api/library/quality-report'); },
  libMissing() { return this.get('/api/library/missing-content'); },
  libVersions() { return this.get('/api/library/versions-report'); },
  libMusic() { return this.get('/api/library/music-report'); },
  libScan() { return this.get('/api/library/scan'); },
  libRefreshAll() { return this.get('/api/library/refresh-all'); },
  libRefreshMeta(id) { return this.get(`/api/library/refresh-metadata?id=${id}`); },
  libRefreshImages(id) { return this.get(`/api/library/refresh-images?id=${id}`); },
  libGetItem(id) { return this.get(`/api/library/get-item?id=${id}`); },
  libUpdateItem(itemId, updates) { return this.post('/api/library/update-item', { itemId, updates }); },
  libAiFix(itemId) { return this.post('/api/library/ai-autofix', { itemId }); },
  libThresholds(params) { return this.get(`/api/library/thresholds?${new URLSearchParams(params).toString()}`); },

  // Proxy helpers
  imageUrl(id, type = 'Primary', w = 600) { return `/proxy/image?id=${id}&type=${type}&w=${w}`; },
  streamUrl(id) { return `/proxy/stream?id=${id}`; },
};

export default API;
