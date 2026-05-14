import API from './api.js';
import { loadSettings, get as getSetting, set as setSetting, applyTheme, initSettingsPanel, playSound, showToast } from './themes.js';
import { initPlayer, playItem, stopPlayer } from './player.js';

// ── State ──
let currentView = 'login';
let pollTimer = null;
let ssTimer = null, ssItems = [], ssIdx = 0, ssActive = false, ssProgTimer = null;
let lastNowPlayingId = null;
let qrInstance = null;
let moviesStart = 0, moviesTotal = 0;
let showsStart = 0, showsTotal = 0;
let currentEditItem = null;

// ── Init ──
loadSettings();

async function init() {
  initPlayer();

  // Persistent player back button (always visible on hover/touch)
  const playerBack = document.getElementById('player-back');
  if (playerBack) {
    playerBack.addEventListener('click', () => {
      stopPlayer();
      navigate('home');
      playSound('click');
    });
  }

  initNav();
  initSearch();
  initSettings();
  initDetailModal();
  initMetaEditor();
  initLibraryTools();
  initScreensaver();

  window.addEventListener('navigate', e => navigate(e.detail.view));
  window.addEventListener('auth:expired', () => navigate('login'));
  window.addEventListener('player:ended', () => navigate('home'));

  // Check if already logged in
  try {
    const user = await API.me();
    sessionStorage.setItem('cf_user', JSON.stringify(user));
    onLoggedIn(user);
  } catch(e) {
    navigate('login');
  }
}

// ── Auth ──
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errorEl = document.getElementById('login-error');
  if (!username || !password) { errorEl.textContent = 'Enter username and password'; return; }
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true; errorEl.textContent = '';
  try {
    const result = await API.login(username, password);
    sessionStorage.setItem('cf_user', JSON.stringify(result.user));
    onLoggedIn(result.user);
  } catch(e) {
    errorEl.textContent = e.message || 'Login failed';
    btn.textContent = 'Sign In'; btn.disabled = false;
  }
}

function onLoggedIn(user) {
  document.getElementById('nav-user').textContent = user.name;
  document.getElementById('s-username').textContent = user.name;
  navigate('home');
  startPoll();
  loadHomeData();
}

// ── Navigation ──
function navigate(viewName) {
  if (currentView === viewName && viewName !== 'home') return;
  if (currentView === 'player' && viewName !== 'player') stopPlayer();

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');
  currentView = viewName;

  const nav = document.getElementById('nav');
  if (viewName === 'login' || viewName === 'player') {
    nav.classList.add('hidden');
  } else {
    nav.classList.remove('hidden');
  }

  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === viewName));

  // Load view data
  if (viewName === 'movies') loadMovies();
  if (viewName === 'shows') loadShows();
  if (viewName === 'music') loadMusic();
  if (viewName === 'health') loadHealth();
  if (viewName === 'library') loadLibrary();
}

function initNav() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => { navigate(btn.dataset.view); playSound('click'); });
  });
  document.getElementById('s-logout').addEventListener('click', async () => {
    await API.logout().catch(() => {});
    sessionStorage.removeItem('cf_user');
    stopPoll();
    navigate('login');
    playSound('click');
  });
}

// ── Home ──
async function loadHomeData() {
  loadStats();
  loadWeather();
  renderHomeSections();
}

async function loadStats() {
  try {
    const d = await API.stats();
    document.getElementById('stat-movies').textContent = (d.movies || 0).toLocaleString();
    document.getElementById('stat-shows').textContent = (d.shows || 0).toLocaleString();
    document.getElementById('stat-episodes').textContent = (d.episodes || 0).toLocaleString();
    document.getElementById('stat-songs').textContent = (d.songs || 0).toLocaleString();
  } catch(e) {}
}

async function loadWeather() {
  if (!getSetting('weather')) return;
  const city = getSetting('city') || 'Brisbane';
  try {
    const d = await API.weather(city);
    if (!d) return;
    const icons = { 113:'☀️', 116:'⛅', 119:'☁️', 122:'☁️', 143:'🌫️', 176:'🌦️', 185:'🌧️', 200:'⛈️', 227:'🌨️', 230:'❄️', 248:'🌫️', 260:'🌫️', 263:'🌧️', 266:'🌧️', 281:'🌧️', 284:'🌧️', 293:'🌧️', 296:'🌧️', 299:'🌧️', 302:'🌧️', 305:'🌧️', 308:'🌧️', 311:'🌧️', 314:'🌧️', 317:'🌧️', 320:'❄️', 323:'❄️', 326:'❄️', 329:'❄️', 332:'❄️', 335:'❄️', 338:'❄️', 350:'🌧️', 353:'🌦️', 356:'⛈️', 359:'⛈️', 362:'🌧️', 365:'🌧️', 368:'❄️', 371:'❄️', 374:'🌧️', 377:'🌧️', 386:'⛈️', 389:'⛈️', 392:'⛈️', 395:'❄️' };
    const icon = icons[d.code] || '🌤️';
    const temp = getSetting('units') === 'F' ? `${d.tempF}°F` : `${d.temp}°C`;
    document.getElementById('weather-icon').textContent = icon;
    document.getElementById('weather-temp').textContent = temp;
    document.getElementById('weather-desc').textContent = d.desc;
    document.getElementById('weather-pill').style.display = '';
  } catch(e) {}
}

async function renderHomeSections() {
  const container = document.getElementById('home-sections');
  if (!container) return;
  const sections = [
    { key: 'continue', label: 'Continue Watching', fn: API.continueWatching.bind(API) },
    { key: 'recent', label: 'Recently Added', fn: API.recentlyAdded.bind(API) },
    { key: 'popular', label: 'Most Popular', fn: API.popular.bind(API) },
    { key: 'history', label: 'Watch History', fn: API.history.bind(API) },
    { key: 'best3d', label: 'Best in 3D 🎬', fn: API.best3D.bind(API) },
    { key: 'onthisday', label: 'On This Day', fn: API.onThisDay.bind(API) },
    { key: 'coming', label: 'Coming Soon', fn: API.comingSoon.bind(API) },
    { key: 'random', label: '🎲 Feeling Lucky', fn: async () => { const r = await API.random(); return r ? [r] : []; } },
  ];
  container.innerHTML = '';
  for (const sec of sections) {
    const secEl = document.createElement('div'); secEl.className = 'section';
    secEl.innerHTML = `<div class="section-header"><div class="section-title">${sec.label}</div></div><div class="card-row" id="row-${sec.key}"></div>`;
    container.appendChild(secEl);
    try {
      const items = await sec.fn();
      const row = document.getElementById(`row-${sec.key}`);
      if (!items || !items.length) { secEl.style.display = 'none'; continue; }
      items.forEach(item => row.appendChild(mkCard(item)));
      if (sec.key === 'recent') {
        ssItems = items.filter(i => i.backdropUrl || i.posterUrl);
        updateHero(items[0]);
      }
    } catch(e) {}
  }
}

function updateHero(item) {
  if (!item) return;
  document.getElementById('hero-bg').style.backgroundImage = `url('${item.backdropUrl || item.posterUrl}')`;
  document.getElementById('hero-title').textContent = item.title || '';
  document.getElementById('hero-meta').textContent = [item.year, item.genre, item.rating].filter(Boolean).join(' · ');
  document.getElementById('hero-label').textContent = 'Recently Added';
}

// ── Now Playing poll ──
function startPoll() {
  pollTimer = setInterval(pollNowPlaying, 4000);
  pollNowPlaying();
}

function stopPoll() { clearInterval(pollTimer); }

async function pollNowPlaying() {
  try {
    const data = await API.nowPlaying();
    if (!data || !data.item) {
      if (lastNowPlayingId && currentView === 'playing') navigate('home');
      lastNowPlayingId = null;
      return;
    }
    const item = data.item;
    if (item.id !== lastNowPlayingId) {
      lastNowPlayingId = item.id;
      playSound('play');
      showToast('🎬', `Now playing: ${item.title}`);
    }
    updateNowPlaying(data);
    if (currentView === 'home') navigate('playing');
  } catch(e) {}
}

function updateNowPlaying(data) {
  const item = data.item;
  document.getElementById('playing-backdrop').style.backgroundImage = `url('${item.backdropUrl}')`;
  document.getElementById('playing-poster').src = item.posterUrl || '';
  document.getElementById('playing-title').textContent = item.title || '';

  const metaParts = [];
  if (item.type === 'Episode' && item.seriesName) metaParts.push(item.seriesName);
  if (item.type === 'Episode') metaParts.push(`S${String(item.parentIndexNumber||0).padStart(2,'0')}E${String(item.indexNumber||0).padStart(2,'0')}`);
  metaParts.push(...[item.year, item.rating].filter(Boolean));
  document.getElementById('playing-meta').textContent = metaParts.join(' · ');

  // Progress
  if (data.runtimeTicks) {
    const pct = Math.min(100, (data.positionTicks / data.runtimeTicks) * 100);
    document.getElementById('playing-fill').style.width = `${pct}%`;
    document.getElementById('playing-current').textContent = fmtTicks(data.positionTicks);
    document.getElementById('playing-total').textContent = fmtTicks(data.runtimeTicks);
  }

  // Paused
  document.getElementById('playing-paused-overlay').classList.toggle('visible', data.isPaused);

  // Quality badges
  const badges = document.getElementById('playing-badges');
  badges.innerHTML = '';
  (item.qualities || []).forEach(q => {
    const b = document.createElement('div');
    b.className = 'playing-badge';
    const cls = q.includes('3D') ? 'badge-3d' : q.startsWith('4K') ? 'badge-4k' : q.includes('1080') ? 'badge-1080' : 'badge-720';
    b.style.cssText = `background:var(--${cls === 'badge-3d' ? 'green' : cls === 'badge-4k' ? 'accent' : cls === 'badge-1080' ? 'blue' : 'muted'});color:var(--bg);`;
    b.textContent = q; badges.appendChild(b);
  });
  if (item.audio) {
    const b = document.createElement('div');
    b.className = 'playing-badge';
    b.style.cssText = 'background:rgba(93,173,226,0.2);color:rgba(93,173,226,0.9);border:1px solid rgba(93,173,226,0.3)';
    b.textContent = item.audio; badges.appendChild(b);
  }

  // Users
  const usersEl = document.getElementById('playing-users');
  usersEl.innerHTML = (data.allUsers || []).map(u => `<div class="playing-user-pill">${u.user} ${u.isPaused ? '⏸' : '▶'}</div>`).join('');

  // Trailer QR
  if (data.trailerKey && getSetting('trailer')) {
    const qrEl = document.getElementById('playing-qr');
    qrEl.classList.add('visible');
    try {
      if (qrInstance) { qrInstance.clear(); qrInstance.makeCode(`https://youtube.com/watch?v=${data.trailerKey}`); }
      else qrInstance = new QRCode(document.getElementById('playing-qr-canvas'), { text: `https://youtube.com/watch?v=${data.trailerKey}`, width: 56, height: 56, colorDark: '#ffffff', colorLight: '#000000' });
    } catch(e) {}
  } else {
    document.getElementById('playing-qr').classList.remove('visible');
  }
}

function fmtTicks(ticks) {
  const s = Math.floor((ticks || 0) / 10000000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

// ── Cards ──
function qualityBadgeClass(q) {
  if (q.includes('3D')) return 'badge-3d';
  if (q.startsWith('4K')) return 'badge-4k';
  if (q.includes('1080')) return 'badge-1080';
  if (q.includes('720')) return 'badge-720';
  return 'badge-sd';
}

function mkCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  const itemCopy = JSON.parse(JSON.stringify(item));
  card.addEventListener('click', () => {
    openDetail(itemCopy, true); // true = open in fullscreen on home screen
    playSound('open');
  });

  const wrap = document.createElement('div'); wrap.className = 'card-img-wrap';
  wrap.style.pointerEvents = 'none';

  if (item.posterUrl) {
    const img = document.createElement('img'); img.className = 'card-img'; img.src = item.posterUrl; img.alt = item.title || '';
    img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
    wrap.appendChild(img);
  }
  const ph = document.createElement('div'); ph.className = 'card-ph'; ph.textContent = 'NO IMG';
  if (item.posterUrl) ph.style.display = 'none';
  wrap.appendChild(ph);

  // Badges
  if (item.qualities && item.qualities.length) {
    const badges = document.createElement('div'); badges.className = 'badges';
    item.qualities.forEach(q => {
      const b = document.createElement('div'); b.className = `badge ${qualityBadgeClass(q)}`; b.textContent = q;
      badges.appendChild(b);
    });
    wrap.appendChild(badges);
  }
  if (item.audio) {
    const ab = document.createElement('div'); ab.className = 'badge-audio'; ab.textContent = item.audio; wrap.appendChild(ab);
  }
  if (item.versionCount > 1) {
    const vb = document.createElement('div'); vb.className = 'badge-ver'; vb.textContent = `×${item.versionCount}`; wrap.appendChild(vb);
  }
  if (item.userData && item.userData.PlayedPercentage > 0) {
    const pb = document.createElement('div'); pb.className = 'card-progress';
    const pf = document.createElement('div'); pf.className = 'card-progress-fill'; pf.style.width = `${item.userData.PlayedPercentage}%`;
    pb.appendChild(pf); wrap.appendChild(pb);
  }

  card.appendChild(wrap);
  const title = document.createElement('div'); title.className = 'card-title';
  title.textContent = (item.type === 'Episode' && item.seriesName) ? item.seriesName : (item.title || '');
  card.appendChild(title);
  const meta = document.createElement('div'); meta.className = 'card-meta';
  meta.textContent = [item.year, item.score ? `★${parseFloat(item.score).toFixed(1)}` : ''].filter(Boolean).join(' · ');
  card.appendChild(meta);
  return card;
}

// ── Detail modal ──
let detailQR = null;

function initDetailModal() {
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('detail-modal').addEventListener('click', e => { if (e.target.id === 'detail-modal') closeDetail(); });
  document.getElementById('detail-fs-btn').addEventListener('click', () => {
    const modal = document.getElementById('detail-modal');
    const isFs = modal.classList.toggle('fullscreen');
    document.getElementById('detail-fs-btn').textContent = isFs ? '⊡' : '⛶';
    if (isFs && window._detailItem) {
      const backdrop = document.getElementById('detail-backdrop');
      backdrop.style.backgroundImage = `url('${window._detailItem.backdropUrl || window._detailItem.posterUrl}')`;
    }
    playSound('click');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeDetail(); closeSearch(); document.getElementById('settings-panel').classList.remove('open'); } });
  document.getElementById('detail-play-btn').addEventListener('click', () => {
    if (!window._detailItem) return;
    playSound('play');
    closeDetail();
    navigate('player');
    playItem(window._detailItem);
  });
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    if (window._detailItem) openMetaEditor(window._detailItem);
  });
}

function openDetail(item, fullscreen = false) {
  if (!item) return;
  window._detailItem = item;
  const modal = document.getElementById('detail-modal');
  modal.classList.add('open');
  if (fullscreen) {
    modal.classList.add('fullscreen');
    document.getElementById('detail-fs-btn').textContent = '⊡';
    const backdrop = document.getElementById('detail-backdrop');
    if (backdrop) backdrop.style.backgroundImage = `url('${item.backdropUrl || item.posterUrl}')`;
  }

  document.getElementById('detail-poster').src = item.posterUrl || '';
  document.getElementById('detail-type').textContent = item.type === 'Episode' ? `${item.seriesName || ''} · S${String(item.parentIndexNumber||0).padStart(2,'0')}E${String(item.indexNumber||0).padStart(2,'0')}` : (item.type || 'Movie');
  document.getElementById('detail-title').textContent = item.title || '';
  document.getElementById('detail-tagline').textContent = item.tagline || '';
  document.getElementById('detail-overview').textContent = item.overview || '';

  // Chips
  const chips = document.getElementById('detail-chips'); chips.innerHTML = '';
  [[item.year,'chip-a'],[item.genre,'chip-p'],[item.rating,'chip-a'],[item.score ? `★ ${parseFloat(item.score).toFixed(1)}` : '','chip-p']].forEach(([v,cls]) => {
    if (!v) return;
    const c = document.createElement('div'); c.className = `chip ${cls}`; c.textContent = v; chips.appendChild(c);
  });
  (item.qualities || []).forEach(q => {
    const cls = q.includes('3D') ? 'chip-3d' : q.startsWith('4K') ? 'chip-4k' : 'chip-a';
    const c = document.createElement('div'); c.className = `chip ${cls}`; c.textContent = q; chips.appendChild(c);
  });
  if (item.audio) {
    const isHigh = ['Atmos','DTS:X','TrueHD','DTS-HD MA'].includes(item.audio);
    const c = document.createElement('div'); c.className = `chip ${isHigh ? 'chip-a' : 'chip-p'}`; c.textContent = `🔊 ${item.audio}`; chips.appendChild(c);
  }
  if (item.versionCount > 1) { const c = document.createElement('div'); c.className = 'chip chip-p'; c.textContent = `📀 ${item.versionCount} versions`; chips.appendChild(c); }
  if (item.studios && item.studios.length) { const c = document.createElement('div'); c.className = 'chip chip-p'; c.textContent = item.studios[0]; chips.appendChild(c); }

  // Cast
  const castGrid = document.getElementById('detail-cast');
  const castLabel = document.getElementById('detail-cast-label');
  castGrid.innerHTML = '';
  const cast = item.cast || [];
  if (cast.length) {
    castLabel.style.display = '';
    cast.forEach(actor => {
      const wrap = document.createElement('div'); wrap.className = 'cast-item';
      if (actor.imageTag) {
        const img = document.createElement('img'); img.className = 'cast-photo';
        img.src = `/proxy/image?id=${actor.id}&type=Primary&w=185`; img.alt = actor.name || '';
        img.onerror = () => img.replaceWith(mkActorPh(actor.name));
        wrap.appendChild(img);
      } else wrap.appendChild(mkActorPh(actor.name));
      const n = document.createElement('div'); n.className = 'cast-name'; n.textContent = actor.name || ''; wrap.appendChild(n);
      castGrid.appendChild(wrap);
    });
  } else castLabel.style.display = 'none';

  document.getElementById('detail-crew').textContent = item.director ? `Directed by ${item.director}` : '';

  // Play button (only for items with video)
  const playBtn = document.getElementById('detail-play-btn');
  playBtn.style.display = (item.type === 'Movie' || item.type === 'Episode') ? '' : 'none';

  // Trailer QR
  // (loaded when detail is shown with cast data)
}

function mkActorPh(name) {
  const el = document.createElement('div'); el.className = 'cast-ph';
  el.textContent = (name || '?')[0].toUpperCase(); return el;
}

function closeDetail() {
  const modal = document.getElementById('detail-modal');
  modal.classList.remove('open', 'fullscreen');
  document.getElementById('detail-fs-btn').textContent = '⛶';
  window._detailItem = null;
}

// ── Search ──
let searchDebounce = null;

function initSearch() {
  const btn = document.getElementById('search-btn');
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-input');

  btn.addEventListener('click', () => { overlay.classList.add('open'); input.focus(); playSound('open'); });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });
  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(doSearch, 300);
  });
}

function closeSearch() {
  document.getElementById('search-overlay').classList.remove('open');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
}

async function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  const results = document.getElementById('search-results');
  if (q.length < 2) { results.innerHTML = ''; return; }
  try {
    const items = await API.search(q);
    results.innerHTML = '';
    if (!items || !items.length) { results.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-style:italic">No results found</div>'; return; }
    items.forEach(item => {
      const itemCopy = JSON.parse(JSON.stringify(item));
      const el = document.createElement('div'); el.className = 'search-result';
      el.addEventListener('click', () => { closeSearch(); openDetail(itemCopy, true); playSound('open'); });
      el.innerHTML = `<img class="search-result-img" src="${item.posterUrl||''}" alt="" onerror="this.style.display='none'" /><div class="search-result-info"><div class="search-result-title">${item.title||''}</div><div class="search-result-meta">${[item.type,item.year,item.genre].filter(Boolean).join(' · ')}</div><div class="search-result-overview">${item.overview||''}</div></div>`;
      results.appendChild(el);
    });
  } catch(e) {}
}

// ── Settings ──
function initSettings() {
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.toggle('open');
    playSound('click');
  });
  document.getElementById('settings-close').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.remove('open');
    playSound('click');
  });
  initSettingsPanel();
  initLayoutMode();
}

function initLayoutMode() {
  const modeSelect = document.getElementById('s-mode');
  const layoutSelect = document.getElementById('s-layout');

  // Restore saved values
  const savedMode = localStorage.getItem('cf-mode') || 'advanced';
  const savedLayout = localStorage.getItem('cf-layout') || 'desktop';
  if (modeSelect) modeSelect.value = savedMode;
  if (layoutSelect) layoutSelect.value = savedLayout;
  applyLayoutMode(savedMode, savedLayout);

  if (modeSelect) modeSelect.addEventListener('change', () => {
    const mode = modeSelect.value;
    const layout = layoutSelect ? layoutSelect.value : 'desktop';
    localStorage.setItem('cf-mode', mode);
    applyLayoutMode(mode, layout);
    playSound('click');
  });
  if (layoutSelect) layoutSelect.addEventListener('change', () => {
    const layout = layoutSelect.value;
    const mode = modeSelect ? modeSelect.value : 'advanced';
    localStorage.setItem('cf-layout', layout);
    applyLayoutMode(mode, layout);
    playSound('click');
  });
}

function applyLayoutMode(mode, layout) {
  const app = document.getElementById('app');
  // Mode
  app.setAttribute('data-mode', mode);
  // Layout
  if (layout === 'tv' || layout === 'mobile') {
    app.setAttribute('data-layout', layout);
  } else {
    app.removeAttribute('data-layout');
  }
}

// ── Movies ──
async function loadMovies(append = false) {
  if (!append) { moviesStart = 0; moviesTotal = 0; document.getElementById('movies-grid').innerHTML = ''; }
  try {
    if (!append && !document.getElementById('movies-genre').options.length > 1) loadGenreFilter('movies-genre', 'Movie');
    const sort = document.getElementById('movies-sort').value;
    const order = document.getElementById('movies-order').value;
    const genre = document.getElementById('movies-genre').value;
    const data = await API.movies({ sort, order, genre, start: moviesStart });
    moviesTotal = data.total || 0;
    moviesStart += (data.items || []).length;
    document.getElementById('movies-count').textContent = `${moviesTotal.toLocaleString()} movies`;
    const grid = document.getElementById('movies-grid');
    if (!append) grid.innerHTML = '';
    (data.items || []).forEach(item => grid.appendChild(mkCard(item)));
    document.getElementById('movies-more').style.display = moviesStart < moviesTotal ? '' : 'none';
  } catch(e) {}
}

async function loadGenreFilter(selectId, type) {
  try {
    const genres = await API.genres(type);
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">All Genres</option>';
    genres.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; if (g === current) o.selected = true; sel.appendChild(o); });
  } catch(e) {}
}

document.getElementById('movies-sort').addEventListener('change', () => loadMovies());
document.getElementById('movies-order').addEventListener('change', () => loadMovies());
document.getElementById('movies-genre').addEventListener('change', () => loadMovies());
document.getElementById('movies-more').addEventListener('click', () => loadMovies(true));

// Auto-load more on scroll
document.getElementById('view-movies').addEventListener('scroll', () => {
  const el = document.getElementById('view-movies');
  const moreBtn = document.getElementById('movies-more');
  if (moreBtn.style.display !== 'none' && el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
    loadMovies(true);
  }
});
document.getElementById('view-shows').addEventListener('scroll', () => {
  const el = document.getElementById('view-shows');
  const moreBtn = document.getElementById('shows-more');
  if (moreBtn.style.display !== 'none' && el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
    loadShows(true);
  }
});

// Auto-load genres on first movies view
let moviesGenresLoaded = false;
const moviesGenreObs = new MutationObserver(() => {
  if (document.getElementById('view-movies').classList.contains('active') && !moviesGenresLoaded) {
    moviesGenresLoaded = true; loadGenreFilter('movies-genre', 'Movie');
  }
});
moviesGenreObs.observe(document.getElementById('view-movies'), { attributes: true });

// ── TV Shows ──
async function loadShows(append = false) {
  if (!append) { showsStart = 0; showsTotal = 0; document.getElementById('shows-grid').innerHTML = ''; }
  try {
    const sort = document.getElementById('shows-sort').value;
    const order = document.getElementById('shows-order').value;
    const genre = document.getElementById('shows-genre').value;
    const data = await API.shows({ sort, order, genre, start: showsStart });
    showsTotal = data.total || 0;
    showsStart += (data.items || []).length;
    document.getElementById('shows-count').textContent = `${showsTotal.toLocaleString()} shows`;
    const grid = document.getElementById('shows-grid');
    if (!append) grid.innerHTML = '';
    (data.items || []).forEach(item => grid.appendChild(mkCard(item)));
    document.getElementById('shows-more').style.display = showsStart < showsTotal ? '' : 'none';
  } catch(e) {}
}

document.getElementById('shows-sort').addEventListener('change', () => loadShows());
document.getElementById('shows-order').addEventListener('change', () => loadShows());
document.getElementById('shows-genre').addEventListener('change', () => loadShows());
document.getElementById('shows-more').addEventListener('click', () => loadShows(true));

// ── Music ──
async function loadMusic() {
  const content = document.getElementById('music-content');
  content.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const albums = await API.albums();
    content.innerHTML = '';
    if (!albums || !albums.length) { content.innerHTML = '<div class="empty-state">No music found</div>'; return; }
    const grid = document.createElement('div'); grid.className = 'card-grid';
    albums.forEach(album => {
      const card = document.createElement('div'); card.className = 'card';
      card.addEventListener('click', () => openMusicAlbum(album));
      const wrap = document.createElement('div'); wrap.className = 'card-img-wrap'; wrap.style.pointerEvents = 'none';
      const img = document.createElement('img'); img.className = 'card-img'; img.src = album.imageUrl || ''; img.alt = album.title || '';
      img.onerror = () => { const ph = document.createElement('div'); ph.className = 'card-ph'; ph.textContent = '🎵'; wrap.innerHTML = ''; wrap.appendChild(ph); };
      wrap.appendChild(img); card.appendChild(wrap);
      const title = document.createElement('div'); title.className = 'card-title'; title.textContent = album.title || ''; card.appendChild(title);
      const meta = document.createElement('div'); meta.className = 'card-meta'; meta.textContent = [album.artist, album.year].filter(Boolean).join(' · '); card.appendChild(meta);
      grid.appendChild(card);
    });
    content.appendChild(grid);
  } catch(e) { content.innerHTML = '<div class="empty-state">Failed to load music</div>'; }
}

function openMusicAlbum(album) {
  // Future: show album detail with track list
  showToast('🎵', album.title);
}

// ── Screensaver ──
function initScreensaver() {
  document.getElementById('screensaver').addEventListener('click', stopSS);
  document.addEventListener('mousemove', resetSS);
  document.addEventListener('touchstart', resetSS);
  document.addEventListener('keydown', resetSS);
  resetSS();
}

function resetSS() {
  stopSS();
  if (!getSetting('ss') || !ssItems.length) return;
  clearTimeout(ssTimer);
  ssTimer = setTimeout(startSS, (getSetting('ssDelay') || 300) * 1000);
}

function startSS() {
  if (currentView === 'player' || currentView === 'login') return;
  ssActive = true;
  document.getElementById('screensaver').classList.add('visible');
  showSSSlide();
}

function stopSS() {
  ssActive = false;
  document.getElementById('screensaver').classList.remove('visible');
  clearInterval(ssProgTimer);
  document.getElementById('ss-bar').style.width = '0%';
  resetSS();
}

function showSSSlide() {
  if (!ssActive || !ssItems.length) return;
  const item = ssItems[ssIdx % ssItems.length];
  document.getElementById('ss-bg').style.backgroundImage = item.backdropUrl ? `url('${item.backdropUrl}')` : item.posterUrl ? `url('${item.posterUrl}')` : '';
  document.getElementById('ss-title').textContent = item.title || '';
  document.getElementById('ss-meta').textContent = [item.year, item.genre].filter(Boolean).join(' · ');
  document.getElementById('ss-overview').textContent = item.overview || '';
  let pct = 0; clearInterval(ssProgTimer);
  const delay = (getSetting('ssDelay') || 300) * 1000;
  ssProgTimer = setInterval(() => {
    pct += (100 / delay) * 100;
    document.getElementById('ss-bar').style.width = `${Math.min(pct, 100)}%`;
  }, 100);
  setTimeout(() => { ssIdx = (ssIdx + 1) % ssItems.length; if (ssActive) showSSSlide(); }, delay);
}

// ── Health ──
async function loadHealth() {
  const grid = document.getElementById('health-grid');
  grid.innerHTML = '<div class="loading-spinner"></div>';
  document.getElementById('health-activity').innerHTML = '';
  try {
    const [d, sys] = await Promise.all([API.health(), API.systemStats().catch(() => ({}))]);
    grid.innerHTML = '';
    function hCard(title, stats) {
      const card = document.createElement('div'); card.className = 'h-card';
      card.innerHTML = `<div class="h-card-title">${title}</div>`;
      stats.forEach(([label, value, cls]) => {
        const row = document.createElement('div'); row.className = 'h-stat';
        row.innerHTML = `<span class="h-label">${label}</span><span class="h-value ${cls||''}">${value||'—'}</span>`;
        card.appendChild(row);
      });
      return card;
    }
    function bar(pct, color) {
      return `<div class="h-bar"><div class="h-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
    }
    const lc = d.latency < 50 ? 'good' : d.latency < 200 ? 'warn' : 'bad';
    const lcol = d.latency < 50 ? 'var(--green)' : d.latency < 200 ? 'var(--orange)' : 'var(--red)';

    grid.appendChild(hCard('CyanFin', [
      ['Version', 'v0.9.0'],
      d.github ? ['Latest', d.github.latestRelease, d.github.isLatest ? 'good' : 'warn'] : null,
      d.github && !d.github.isLatest ? ['Update', '↗ Available', 'warn'] : null,
    ].filter(Boolean)));

    const connCard = document.createElement('div'); connCard.className = 'h-card';
    connCard.innerHTML = `<div class="h-card-title">Connection</div>
      <div class="h-stat"><span class="h-label">Latency</span><span class="h-value ${lc}">${d.latency}ms</span></div>
      <div class="h-bar"><div class="h-bar-fill" style="width:${Math.min(100,(d.latency/500)*100)}%;background:${lcol}"></div></div>
      <div class="h-stat" style="margin-top:6px"><span class="h-label">Server</span><span class="h-value">${d.serverName||'—'}</span></div>
      <div class="h-stat"><span class="h-label">Version</span><span class="h-value">${d.version||'—'}</span></div>
      <div class="h-stat"><span class="h-label">OS / Arch</span><span class="h-value">${d.os||'—'} ${d.arch||''}</span></div>
      <div class="h-stat"><span class="h-label">Local</span><span class="h-value">${d.localAddress||'—'}</span></div>`;
    grid.appendChild(connCard);

    grid.appendChild(hCard('Sessions', [
      ['Active', d.activeSessions, d.activeSessions > 0 ? 'good' : ''],
      ['Connected', d.totalSessions],
      ['Transcoding', d.transcoding, d.transcoding > 0 ? 'warn' : 'good'],
    ]));

    // System stats
    if (sys.cpuPercent !== undefined) {
      const cc = sys.cpuPercent > 80 ? 'var(--red)' : sys.cpuPercent > 50 ? 'var(--orange)' : 'var(--green)';
      const cpuCard = document.createElement('div'); cpuCard.className = 'h-card';
      cpuCard.innerHTML = `<div class="h-card-title">CPU ${sys.cpuModel ? `<span style="font-weight:400;opacity:0.5;text-transform:none;font-size:8px">${sys.cpuCores}c</span>` : ''}</div>
        <div class="h-stat"><span class="h-label">Usage</span><span class="h-value" style="color:${cc}">${sys.cpuPercent}%</span></div>
        ${bar(sys.cpuPercent, cc)}
        <div class="h-stat" style="margin-top:6px"><span class="h-label">Load</span><span class="h-value">${sys.load1} / ${sys.load5}</span></div>
        <div class="h-stat"><span class="h-label">Uptime</span><span class="h-value">${fmtUptime(sys.uptimeSeconds)}</span></div>`;
      grid.appendChild(cpuCard);
    }
    if (sys.ramPercent !== undefined) {
      const rc = sys.ramPercent > 85 ? 'var(--red)' : sys.ramPercent > 60 ? 'var(--orange)' : 'var(--green)';
      const ramCard = document.createElement('div'); ramCard.className = 'h-card';
      ramCard.innerHTML = `<div class="h-card-title">Memory</div>
        <div class="h-stat"><span class="h-label">Used / Total</span><span class="h-value" style="color:${rc}">${sys.ramUsed} / ${sys.ramTotal} MB</span></div>
        ${bar(sys.ramPercent, rc)}`;
      grid.appendChild(ramCard);
    }
    if (sys.disks && sys.disks.length) {
      const diskCard = document.createElement('div'); diskCard.className = 'h-card';
      diskCard.innerHTML = `<div class="h-card-title">Storage</div>`;
      sys.disks.forEach(d2 => {
        const pct = parseInt(d2.percent) || 0;
        const col = pct > 90 ? 'var(--red)' : pct > 75 ? 'var(--orange)' : 'var(--green)';
        diskCard.innerHTML += `<div style="margin-bottom:8px"><div style="font-size:8px;color:var(--muted);margin-bottom:3px">${d2.mount}</div>
          <div class="h-stat"><span class="h-label">${d2.used} / ${d2.size}</span><span class="h-value" style="color:${col}">${d2.percent}</span></div>
          ${bar(pct, col)}</div>`;
      });
      grid.appendChild(diskCard);
    }
    if (d.libraries && d.libraries.length) {
      const libCard = document.createElement('div'); libCard.className = 'h-card'; libCard.style.gridColumn = '1 / -1';
      libCard.innerHTML = `<div class="h-card-title">Libraries</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">` +
        d.libraries.map(l => `<div style="padding:8px;background:var(--subtle);border-radius:4px"><div style="font-size:8px;color:var(--accent);opacity:0.5;margin-bottom:2px">${l.type||'media'}</div><div style="font-size:11px;color:var(--muted)">${l.name}</div></div>`).join('') + '</div>';
      grid.appendChild(libCard);
    }
    if (d.plugins && d.plugins.length) {
      grid.appendChild(hCard(`Plugins (${d.plugins.length})`, d.plugins.map(p => [p.name, p.version||''])));
    }
    // Activity
    const actEl = document.getElementById('health-activity');
    (d.recentActivity || []).forEach(a => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 0;border-bottom:1px solid var(--border2);display:flex;justify-content:space-between;align-items:center;font-size:11px';
      const col = a.severity === 'Error' ? 'var(--red)' : a.severity === 'Warning' ? 'var(--orange)' : 'var(--muted)';
      row.innerHTML = `<span style="color:${col}">${a.name||''}</span><span style="color:var(--muted);font-size:9px;font-family:monospace">${a.date ? new Date(a.date).toLocaleString() : ''}</span>`;
      actEl.appendChild(row);
    });
  } catch(e) { grid.innerHTML = `<div class="empty-state">${e.message}</div>`; }
}

function fmtUptime(s) {
  if (!s) return '—';
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

document.getElementById('health-refresh').addEventListener('click', () => { loadHealth(); playSound('click'); });

// ── Library Tools ──
function libLog(msg) {
  const log = document.getElementById('lib-log');
  if (log) { log.innerHTML += `<div>${new Date().toLocaleTimeString()} — ${msg}</div>`; log.scrollTop = log.scrollHeight; }
}

function initLibraryTools() {
  // Nav
  document.querySelectorAll('.lib-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.lib-nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.lib-section').forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`ls-${item.dataset.section}`).classList.add('active');
      playSound('click');
    });
  });

  // Quick action buttons
  // Bulk AI fix
  document.getElementById('qa-ai-fix-all').addEventListener('click', async function() {
    if (!confirm('Run AI metadata fix on all items missing overviews? This may take several minutes.')) return;
    this.classList.add('running'); this.textContent = '⏳ Fixing…';
    try {
      const d = await API.libMissing();
      const items = (d.missingOverview || []).slice(0, 20);
      let fixed = 0, failed = 0;
      for (const item of items) {
        try {
          const r = await API.libAiFix(item.id);
          if (r.success && r.suggestion) {
            await API.libUpdateItem(item.id, {
              Overview: r.suggestion.overview || '',
              Taglines: r.suggestion.tagline ? [r.suggestion.tagline] : [],
            });
            fixed++; libLog(`✓ AI fixed: ${item.title}`);
          }
        } catch(e) { failed++; libLog(`✗ Failed: ${item.title} — ${e.message}`); }
        await new Promise(r => setTimeout(r, 500)); // rate limit
      }
      this.textContent = `✓ Fixed ${fixed}${failed ? `, ${failed} failed` : ''}`;
      this.classList.remove('running'); this.classList.add('done');
      showToast('🤖', `AI fixed ${fixed} items`);
    } catch(e) { this.textContent = '✗ Error'; this.classList.remove('running'); libLog('Bulk AI fix error: ' + e.message); }
  });

  document.getElementById('qa-scan').addEventListener('click', async function() {
    this.classList.add('running'); this.textContent = '⏳ Scanning…';
    try { await API.libScan(); libLog('Library scan triggered'); this.textContent = '✓ Done'; this.classList.remove('running'); this.classList.add('done'); } catch(e) { this.textContent = '✗ Failed'; this.classList.remove('running'); }
  });
  document.getElementById('qa-refresh-all').addEventListener('click', async function() {
    if (!confirm('Refresh metadata for ALL items? This may take a while.')) return;
    this.classList.add('running'); this.textContent = '⏳ Refreshing…';
    try { await API.libRefreshAll(); libLog('Full refresh triggered'); this.textContent = '✓ Done'; this.classList.remove('running'); this.classList.add('done'); } catch(e) { this.textContent = '✗ Failed'; this.classList.remove('running'); }
  });
  document.getElementById('qa-fix-images').addEventListener('click', async function() {
    this.classList.add('running'); this.textContent = '⏳ Working…';
    try {
      const d = await API.libMissing();
      let fixed = 0;
      for (const item of (d.missingPoster || []).slice(0, 20)) {
        await API.libRefreshImages(item.id); fixed++; libLog(`Fixed images: ${item.title}`);
      }
      this.textContent = `✓ Fixed ${fixed}`; this.classList.remove('running'); this.classList.add('done');
    } catch(e) { this.textContent = '✗ Failed'; this.classList.remove('running'); }
  });
  document.getElementById('qa-full-scan').addEventListener('click', async function() {
    this.classList.add('running'); this.textContent = '⏳ Scanning…';
    await runAllLibScans();
    this.textContent = '✓ Done'; this.classList.remove('running'); this.classList.add('done');
  });
  document.getElementById('th-save').addEventListener('click', async () => {
    const sd = document.getElementById('th-sd').value;
    const upgrade = document.getElementById('th-upgrade').value;
    const audio = document.getElementById('th-audio').value;
    try { await API.libThresholds({ sd, upgrade, audio }); libLog(`Thresholds: SD=${sd}, Upgrade=${upgrade}, Audio=${audio}`); await runQualityScan(); } catch(e) {}
  });
}

function mkLibItem(item, badge, badgeCls, actions) {
  const el = document.createElement('div'); el.className = 'lib-item';
  const img = document.createElement('img'); img.className = 'lib-item-poster'; img.src = item.posterUrl || ''; img.onerror = () => img.style.opacity = '0';
  const info = document.createElement('div'); info.className = 'lib-item-info';
  const t = document.createElement('div'); t.className = 'lib-item-title'; t.textContent = item.title || '';
  const m = document.createElement('div'); m.className = 'lib-item-meta'; m.textContent = [item.year, item.quality, item.audio, item.versions && item.versions.join(' · ')].filter(Boolean).join(' · ');
  info.appendChild(t); info.appendChild(m);
  const b = document.createElement('div'); b.className = `lib-item-badge ${badgeCls}`; b.textContent = badge;
  const acts = document.createElement('div'); acts.className = 'lib-item-actions';
  (actions || []).forEach(([label, fn]) => {
    const btn = document.createElement('button'); btn.className = 'lib-action-btn'; btn.textContent = label;
    btn.addEventListener('click', async () => { btn.disabled = true; btn.textContent = '…'; await fn(item, btn); });
    acts.appendChild(btn);
  });
  el.appendChild(img); el.appendChild(info); el.appendChild(b); el.appendChild(acts);
  return el;
}

function renderLibList(id, items, badgeFn, badgeClsFn, actionsFn, emptyMsg) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = '';
  if (!items || !items.length) { el.innerHTML = `<div class="lib-empty">✓ ${emptyMsg || 'None found'}</div>`; return; }
  items.slice(0, 30).forEach(item => el.appendChild(mkLibItem(item, badgeFn(item), badgeClsFn(item), actionsFn(item))));
  if (items.length > 30) { const m = document.createElement('div'); m.className = 'lib-empty'; m.textContent = `+ ${items.length - 30} more`; el.appendChild(m); }
}

const editAction = (item, btn) => { openMetaEditor(item); btn.textContent = '✓'; };
const metaAction = async (item, btn) => { try { await API.libRefreshMeta(item.id); btn.textContent = '✓'; btn.classList.add('done'); libLog(`Refreshed: ${item.title}`); } catch(e) { btn.textContent = '✗'; } };
const imgAction = async (item, btn) => { try { await API.libRefreshImages(item.id); btn.textContent = '✓'; btn.classList.add('done'); libLog(`Images: ${item.title}`); } catch(e) { btn.textContent = '✗'; } };

function setBadgeCount(id, count) {
  const el = document.getElementById(id); if (!el) return;
  el.textContent = count; el.style.cssText = `padding:1px 5px;border-radius:8px;font-size:8px;font-weight:700;background:${count > 0 ? 'rgba(231,76,60,0.15)' : 'rgba(46,204,113,0.1)'};color:${count > 0 ? 'var(--red)' : 'var(--green)'}`;
}

async function runQualityScan() {
  libLog('Scanning quality…');
  try {
    const d = await API.libQuality();
    setBadgeCount('cnt-sd', d.sdItems.length); setBadgeCount('cnt-upgrade', d.upgradeItems.length); setBadgeCount('cnt-audio', d.poorAudioItems.length); setBadgeCount('cnt-nostream', d.noStreamItems.length);
    renderLibList('ll-sd', d.sdItems, i => `${i.quality||'SD'} · ${i.audio||'?'}`, () => 'lib-badge-bad', i => [['✏ Edit', editAction], ['↻ Meta', metaAction]]);
    renderLibList('ll-upgrade', d.upgradeItems, i => i.quality||'?', () => 'lib-badge-warn', i => [['✏ Edit', editAction], ['↻ Meta', metaAction]]);
    renderLibList('ll-audio', d.poorAudioItems, i => i.audio||'?', () => 'lib-badge-warn', i => [['✏ Edit', editAction]]);
    renderLibList('ll-nostream', d.noStreamItems, () => 'No Stream', () => 'lib-badge-bad', i => [['↻ Meta', metaAction]]);
    libLog(`Quality: ${d.sdItems.length} SD, ${d.upgradeItems.length} upgrades, ${d.poorAudioItems.length} poor audio`);
    return d;
  } catch(e) { libLog('Quality scan failed: ' + e.message); return {}; }
}

async function runMissingScan() {
  libLog('Scanning missing content…');
  try {
    const d = await API.libMissing();
    setBadgeCount('cnt-noposter', d.missingPoster.length); setBadgeCount('cnt-nobackdrop', d.missingBackdrop.length); setBadgeCount('cnt-nooverview', d.missingOverview.length);
    renderLibList('ll-noposter', d.missingPoster, () => 'No Poster', () => 'lib-badge-bad', i => [['✏ Edit', editAction], ['🖼 Fix', imgAction], ['↻ Meta', metaAction]]);
    renderLibList('ll-nobackdrop', d.missingBackdrop, () => 'No Backdrop', () => 'lib-badge-warn', i => [['🖼 Fix', imgAction]]);
    renderLibList('ll-nooverview', d.missingOverview, () => 'No Overview', () => 'lib-badge-warn', i => [['✏ Edit', editAction], ['↻ Meta', metaAction]]);
    libLog(`Missing: ${d.missingPoster.length} posters, ${d.missingBackdrop.length} backdrops, ${d.missingOverview.length} overviews`);
    return d;
  } catch(e) { libLog('Missing scan failed: ' + e.message); return {}; }
}

async function runVersionsScan() {
  libLog('Scanning versions…');
  try {
    const d = await API.libVersions();
    setBadgeCount('cnt-multi', d.multiVersion.length); setBadgeCount('cnt-3d', d.has3D.length); setBadgeCount('cnt-2d', d.only2D.length);
    renderLibList('ll-multi', d.multiVersion, i => `${i.count} versions`, () => 'lib-badge-info', i => [], 'No multi-version movies');
    renderLibList('ll-3d', d.has3D, i => i.versions.join(' · '), () => 'lib-badge-good', i => [], 'No 3D movies found');
    renderLibList('ll-2d', d.only2D, () => '2D only', () => 'lib-badge-warn', i => [], 'All movies have 3D');
    libLog(`Versions: ${d.multiVersion.length} multi, ${d.has3D.length} with 3D`);
    return d;
  } catch(e) { libLog('Versions scan failed: ' + e.message); return {}; }
}

async function runMusicScan() {
  libLog('Scanning music…');
  try {
    const d = await API.libMusic();
    setBadgeCount('cnt-noart', d.missingArt.length);
    const grid = document.getElementById('lib-music-grid');
    if (grid) grid.innerHTML = `
      <div class="h-card"><div class="h-card-title">Albums</div><div class="h-big">${d.totalAlbums}</div><div style="font-size:9px;color:var(--muted)">Total albums</div></div>
      <div class="h-card"><div class="h-card-title">Tracks</div><div class="h-big">${d.totalTracks}</div><div style="font-size:9px;color:var(--muted)">Total tracks</div></div>
      <div class="h-card"><div class="h-card-title">Missing Art</div><div class="h-big ${d.missingArt.length > 0 ? 'warn' : 'good'}">${d.missingArt.length}</div><div style="font-size:9px;color:var(--muted)">Albums without artwork</div></div>`;
    renderLibList('ll-noart', d.missingArt, () => 'No Art', () => 'lib-badge-warn', i => [['🖼 Fix', imgAction]]);
    libLog(`Music: ${d.totalAlbums} albums, ${d.totalTracks} tracks, ${d.missingArt.length} missing art`);
    return d;
  } catch(e) { libLog('Music scan failed'); return {}; }
}

async function runAllLibScans() {
  const [q, m, v, mu] = await Promise.all([runQualityScan(), runMissingScan(), runVersionsScan(), runMusicScan()]);
  const grid = document.getElementById('lib-overview-grid');
  if (grid) grid.innerHTML = [
    ['SD Files', (q.sdItems||[]).length, (q.sdItems||[]).length > 0 ? 'warn' : 'good', 'Movies below quality threshold'],
    ['Upgrades', (q.upgradeItems||[]).length, (q.upgradeItems||[]).length > 0 ? 'warn' : 'good', 'Potential quality upgrades'],
    ['Poor Audio', (q.poorAudioItems||[]).length, (q.poorAudioItems||[]).length > 0 ? 'warn' : 'good', 'No surround sound'],
    ['No Poster', (m.missingPoster||[]).length, (m.missingPoster||[]).length > 0 ? 'bad' : 'good', 'Missing poster image'],
    ['No Overview', (m.missingOverview||[]).length, (m.missingOverview||[]).length > 0 ? 'warn' : 'good', 'Missing description'],
    ['3D Movies', (v.has3D||[]).length, 'good', 'Movies with 3D version'],
    ['Multi-Version', (v.multiVersion||[]).length, '', 'Multiple file versions'],
    ['Music Albums', mu.totalAlbums||0, '', `${mu.totalTracks||0} tracks`],
  ].map(([title, count, cls, desc]) => `<div class="h-card"><div class="h-card-title">${title}</div><div class="h-big ${cls}">${count}</div><div style="font-size:9px;color:var(--muted)">${desc}</div></div>`).join('');
  libLog('Full scan complete!');
}

async function loadLibrary() {
  await runAllLibScans();
}

// ── Metadata Editor ──
function initMetaEditor() {
  document.getElementById('meta-close').addEventListener('click', () => document.getElementById('meta-editor').classList.remove('open'));
  document.getElementById('meta-editor').addEventListener('click', e => { if (e.target.id === 'meta-editor') document.getElementById('meta-editor').classList.remove('open'); });
  document.getElementById('meta-save').addEventListener('click', saveMetadata);
  document.getElementById('meta-rescrape').addEventListener('click', reScrapeMetadata);
  document.getElementById('meta-ai').addEventListener('click', aiFixMetadata);
  document.getElementById('ai-apply-overview').addEventListener('click', () => {
    document.getElementById('me-overview').value = document.getElementById('ai-overview-text').textContent;
    document.getElementById('meta-status').textContent = 'AI overview applied — save to keep it';
  });
  document.getElementById('ai-apply-tagline').addEventListener('click', () => {
    document.getElementById('me-tagline').value = document.getElementById('ai-tagline-text').textContent;
    document.getElementById('meta-status').textContent = 'AI tagline applied — save to keep it';
  });
}

function openMetaEditor(item) {
  currentEditItem = item;
  document.getElementById('me-title').value = item.title || item.Name || '';
  document.getElementById('me-year').value = item.year || item.ProductionYear || '';
  document.getElementById('me-overview').value = item.overview || item.Overview || '';
  document.getElementById('me-tagline').value = item.tagline || (item.Taglines && item.Taglines[0]) || '';
  document.getElementById('me-rating').value = item.rating || item.OfficialRating || '';
  document.getElementById('me-genres').value = (item.genres || (item.genre ? item.genre.split(' / ') : [])).join(', ');
  document.getElementById('ai-suggestions').classList.remove('visible');
  document.getElementById('meta-status').textContent = '';
  document.getElementById('meta-editor').classList.add('open');
  playSound('open');
}

async function saveMetadata() {
  if (!currentEditItem) return;
  const status = document.getElementById('meta-status');
  status.textContent = 'Saving…';
  try {
    await API.libUpdateItem(currentEditItem.id || currentEditItem.Id, {
      Name: document.getElementById('me-title').value,
      ProductionYear: parseInt(document.getElementById('me-year').value) || null,
      Overview: document.getElementById('me-overview').value,
      Taglines: [document.getElementById('me-tagline').value].filter(Boolean),
      OfficialRating: document.getElementById('me-rating').value,
      Genres: document.getElementById('me-genres').value.split(',').map(g => g.trim()).filter(Boolean),
    });
    status.textContent = '✓ Saved'; showToast('✅', 'Metadata saved');
  } catch(e) { status.textContent = '✗ ' + e.message; }
}

async function reScrapeMetadata() {
  if (!currentEditItem) return;
  const status = document.getElementById('meta-status');
  status.textContent = 'Re-scraping…';
  try { await API.libRefreshMeta(currentEditItem.id || currentEditItem.Id); status.textContent = '✓ Re-scrape triggered'; } catch(e) { status.textContent = '✗ ' + e.message; }
}

async function aiFixMetadata() {
  if (!currentEditItem) return;
  const btn = document.getElementById('meta-ai');
  const status = document.getElementById('meta-status');
  btn.classList.add('running'); btn.textContent = '⏳ Thinking…'; status.textContent = 'Asking AI…';
  try {
    const d = await API.libAiFix(currentEditItem.id || currentEditItem.Id);
    if (!d.success) { status.textContent = '✗ ' + (d.error || 'AI error'); return; }
    const s = d.suggestion;
    const wrap = document.getElementById('ai-suggestions'); wrap.classList.add('visible');
    if (s.overview) { document.getElementById('ai-overview-wrap').style.display = ''; document.getElementById('ai-overview-text').textContent = s.overview; }
    if (s.tagline) { document.getElementById('ai-tagline-wrap').style.display = ''; document.getElementById('ai-tagline-text').textContent = s.tagline; }
    document.getElementById('ai-issues').innerHTML = (s.issues || []).map(i => `<div class="ai-issue">⚠ ${i}</div>`).join('');
    status.textContent = `AI: ${(s.issues||[]).length} issues found (${Math.round((s.confidence||0)*100)}% confidence)`;
  } catch(e) { status.textContent = '✗ ' + e.message; }
  btn.classList.remove('running'); btn.textContent = '🤖 AI Fix';
}

// ── Start ──
init();
