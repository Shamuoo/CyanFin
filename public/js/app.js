// CyanFin v0.10 — Main app
import API from './api.js';
import { loadSettings, get as getSetting, set as setSetting, applyTheme, initSettingsPanel, playSound, showToast } from './themes.js';
import { initPlayer, playItem, stopPlayer, showControls } from './player.js';
import { initHome, renderHomeSections, loadStats as loadHomeStats, loadWeather, resetSS, mkCard } from './views/home.js';
import { initDetail, openDetail, closeDetail, getCurrentDetailItem } from './views/detail.js';
import { initMovies, loadMovies } from './views/movies.js';
import { initShows, loadShows, openShowSeasons } from './views/shows.js';
import { initMusic, loadMusic } from './views/music.js';
import { loadStats } from './views/stats.js';
import { loadHealth } from './views/health.js';
import { initLibrary, runAllLibScans } from './views/library.js';

// ── State ──
let currentView = 'login';
let pollTimer = null;
let lastNowPlayingId = null;
let qrInstance = null;

loadSettings();

// ── Init ──
async function init() {
  initOnboarding();
  initPlayer();
  initHome();
  initDetail();
  initMovies();
  initShows();
  initMusic();
  initLibrary();
  initNav();
  initSearch();
  initSettings();
  initMetaEditor();
  initSeasonOverlay();

  // Persistent player back button
  ['player-back','player-back-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { e.stopPropagation(); stopPlayer(); navigate('home'); playSound('click'); });
  });

  window.addEventListener('navigate', e => navigate(e.detail.view));
  window.addEventListener('auth:expired', () => navigate('login'));
  window.addEventListener('player:ended', () => navigate('home'));
  window.addEventListener('play-item', e => { navigate('player'); playItem(e.detail.item); });
  window.addEventListener('open-meta-editor', e => openMetaEditor(e.detail.item));

  // Check existing session
  try {
    const user = await API.me();
    sessionStorage.setItem('cf_user', JSON.stringify(user));
    onLoggedIn(user);
  } catch(e) { navigate('login'); }
}

// ── Auth ──
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  if (!username || !password) { err.textContent = 'Enter username and password'; return; }
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true; err.textContent = '';
  try {
    const result = await API.login(username, password);
    sessionStorage.setItem('cf_user', JSON.stringify(result.user));
    API.config().then(cfg => { window._jellyfinUrl = cfg.jellyfinUrl; }).catch(() => {});
    onLoggedIn(result.user);
  } catch(e) {
    err.textContent = e.message || 'Login failed';
    btn.textContent = 'Sign In'; btn.disabled = false;
  }
}

function onLoggedIn(user) {
  document.getElementById('nav-user').textContent = user.name;
  document.getElementById('s-username').textContent = user.name;
  navigate('home');
  startPoll();
  renderHomeSections();
  loadHomeStats();
  loadWeather();
}

// ── Navigation ──
function navigate(viewName) {
  if (currentView === viewName && !['home','player'].includes(viewName)) return;
  if (currentView === 'player' && viewName !== 'player') stopPlayer();

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');
  currentView = viewName;

  const nav = document.getElementById('nav');
  if (nav) nav.classList.toggle('hidden', viewName === 'login' || viewName === 'player');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === viewName));

  if (viewName === 'movies') loadMovies();
  if (viewName === 'shows') loadShows();
  if (viewName === 'music') loadMusic();
  if (viewName === 'health') loadHealth();
  if (viewName === 'library') runAllLibScans();
  if (viewName === 'stats') loadStats();
  if (viewName !== 'player') resetSS();
}

function initNav() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => { navigate(btn.dataset.view); playSound('click'); });
  });
  document.getElementById('s-logout').addEventListener('click', async () => {
    await API.logout().catch(() => {});
    sessionStorage.removeItem('cf_user');
    stopPoll(); navigate('login'); playSound('click');
  });
}

// ── Now Playing poll ──
function startPoll() { pollTimer = setInterval(pollNowPlaying, 5000); pollNowPlaying(); }
function stopPoll() { clearInterval(pollTimer); }

async function pollNowPlaying() {
  try {
    const data = await API.nowPlaying();
    if (!data || !data.item) {
      if (lastNowPlayingId && currentView === 'playing') navigate('home');
      lastNowPlayingId = null; return;
    }
    if (data.item.id !== lastNowPlayingId) {
      lastNowPlayingId = data.item.id;
      playSound('play');
      showToast('🎬', 'Now playing: ' + data.item.title);
    }
    updateNowPlaying(data);
    if (currentView === 'home') navigate('playing');
  } catch(e) {}
}

function fmtTicks(ticks) {
  const s = Math.floor((ticks||0)/10000000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

function updateNowPlaying(data) {
  const item = data.item;
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el[typeof val === 'string' ? 'textContent' : 'style'] = val; };
  document.getElementById('playing-backdrop').style.backgroundImage = `url('${item.backdropUrl}')`;
  document.getElementById('playing-poster').src = item.posterUrl || '';
  document.getElementById('playing-title').textContent = item.title || '';
  const meta = [item.type === 'Episode' ? item.seriesName : null, item.year, item.rating].filter(Boolean).join(' · ');
  document.getElementById('playing-meta').textContent = meta;
  if (data.runtimeTicks) {
    const pct = Math.min(100, (data.positionTicks / data.runtimeTicks) * 100);
    document.getElementById('playing-fill').style.width = pct + '%';
    document.getElementById('playing-current').textContent = fmtTicks(data.positionTicks);
    document.getElementById('playing-total').textContent = fmtTicks(data.runtimeTicks);
  }
  document.getElementById('playing-paused-overlay').classList.toggle('visible', data.isPaused);
  const badges = document.getElementById('playing-badges'); badges.innerHTML = '';
  (item.qualities||[]).forEach(q => {
    const b = document.createElement('div'); b.className = 'playing-badge';
    b.style.cssText = 'font-size:9px;font-weight:800;padding:3px 8px;border-radius:3px;' + (q.includes('3D') ? 'background:rgba(46,204,113,0.8);color:#000' : q.startsWith('4K') ? 'background:rgba(201,168,76,0.8);color:#000' : 'background:rgba(93,173,226,0.8);color:#000');
    b.textContent = q; badges.appendChild(b);
  });
  if (item.audio) {
    const b = document.createElement('div'); b.style.cssText = 'font-size:9px;font-weight:800;padding:3px 8px;border-radius:3px;background:rgba(93,173,226,0.2);color:rgba(93,173,226,0.9);border:1px solid rgba(93,173,226,0.3)';
    b.textContent = item.audio; badges.appendChild(b);
  }
  document.getElementById('playing-users').innerHTML = (data.allUsers||[]).map(u => `<div class="playing-user-pill">${u.user} ${u.isPaused?'⏸':'▶'}</div>`).join('');
  // Trailer QR
  if (data.trailerKey && getSetting('trailer')) {
    const qrEl = document.getElementById('playing-qr'); if (qrEl) qrEl.classList.add('visible');
    try {
      if (qrInstance) { qrInstance.clear(); qrInstance.makeCode('https://youtube.com/watch?v=' + data.trailerKey); }
      else qrInstance = new QRCode(document.getElementById('playing-qr-canvas'), { text: 'https://youtube.com/watch?v=' + data.trailerKey, width:56, height:56, colorDark:'#ffffff', colorLight:'#000000' });
    } catch(e) {}
  } else { const qrEl = document.getElementById('playing-qr'); if (qrEl) qrEl.classList.remove('visible'); }
}

// ── Search ──
let searchDebounce = null;
function initSearch() {
  const btn = document.getElementById('search-btn');
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-input');
  btn.addEventListener('click', () => { overlay.classList.add('open'); input.focus(); playSound('open'); });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSearch(); closeDetail(); document.getElementById('settings-panel').classList.remove('open'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); overlay.classList.add('open'); input.focus(); }
  });
  input.addEventListener('input', () => { clearTimeout(searchDebounce); searchDebounce = setTimeout(doSearch, 300); });
}
function closeSearch() {
  document.getElementById('search-overlay').classList.remove('open');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
}
async function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  const results = document.getElementById('search-results'); results.innerHTML = '';
  if (q.length < 2) return;
  try {
    const items = await API.search(q);
    if (!items || !items.length) { results.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-style:italic">No results</div>'; return; }
    items.forEach(item => {
      const el = document.createElement('div'); el.className = 'search-result';
      el.addEventListener('click', () => { closeSearch(); openDetail(item); playSound('open'); });
      el.innerHTML = `<img class="search-result-img" src="${item.posterUrl||''}" onerror="this.style.display='none'" />
        <div class="search-result-info"><div class="search-result-title">${item.title||''}</div>
        <div class="search-result-meta">${[item.type,item.year,item.genre].filter(Boolean).join(' · ')}</div>
        <div class="search-result-overview">${(item.overview||'').slice(0,120)}</div></div>`;
      results.appendChild(el);
    });
  } catch(e) {}
}

// ── Settings ──
function initSettings() {
  document.getElementById('settings-btn').addEventListener('click', () => { document.getElementById('settings-panel').classList.toggle('open'); playSound('click'); });
  document.getElementById('settings-close').addEventListener('click', () => { document.getElementById('settings-panel').classList.remove('open'); playSound('click'); });
  initSettingsPanel();
  initLayoutMode();
  initSettingsIntegrations();
  // Music tab toggle
  const musicToggle = document.getElementById('s-music');
  const musicNav = document.querySelector('.nav-link[data-view="music"]');
  if (musicToggle && musicNav) {
    const showMusic = localStorage.getItem('cf-show-music') !== 'false';
    if (!showMusic) { musicToggle.classList.remove('on'); musicNav.style.display = 'none'; }
    musicToggle.addEventListener('click', () => {
      musicToggle.classList.toggle('on');
      const show = musicToggle.classList.contains('on');
      localStorage.setItem('cf-show-music', show);
      if (musicNav) musicNav.style.display = show ? '' : 'none';
      playSound('click');
    });
  }
}

async function initSettingsIntegrations() {
  // Load current config from server when settings opens
  document.getElementById('settings-btn').addEventListener('click', async () => {
    try {
      const pub = await API.configPublic();
      // Pre-fill URLs (we show URLs, not keys for security)
      const urlFields = {
        'si-jellyseerr-url': pub.jellyseerrUrl || '',
        'si-radarr-url': pub.radarrUrl || '',
        'si-sonarr-url': pub.sonarrUrl || '',
      };
      Object.entries(urlFields).forEach(([id, val]) => {
        const el = document.getElementById(id); if (el && val) el.value = val;
      });
      // Show configured status for key fields
      ['si-jellyseerr-key','si-radarr-key','si-sonarr-key','si-tmdb','si-anthropic','si-discord'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.placeholder = pub.hasJellyseerr && id.includes('jellyseerr') ? '✓ Configured' :
          pub.hasRadarr && id.includes('radarr') ? '✓ Configured' :
          pub.hasSonarr && id.includes('sonarr') ? '✓ Configured' :
          pub.hasTmdb && id.includes('tmdb') ? '✓ Configured' :
          pub.hasAnthropic && id.includes('anthropic') ? '✓ Configured' :
          pub.hasDiscord && id.includes('discord') ? '✓ Configured' : el.placeholder;
      });
    } catch(e) {}
  }, { once: false });

  // Save button
  const saveBtn = document.getElementById('si-save');
  const status = document.getElementById('si-status');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', async () => {
    saveBtn.textContent = '⏳ Saving…'; saveBtn.disabled = true;
    const fields = {
      'si-jellyseerr-url':  'JELLYSEERR_URL',
      'si-jellyseerr-key':  'JELLYSEERR_API_KEY',
      'si-radarr-url':      'RADARR_URL',
      'si-radarr-key':      'RADARR_API_KEY',
      'si-sonarr-url':      'SONARR_URL',
      'si-sonarr-key':      'SONARR_API_KEY',
      'si-tmdb':            'TMDB_API_KEY',
      'si-anthropic':       'ANTHROPIC_API_KEY',
      'si-discord':         'DISCORD_WEBHOOK_URL',
    };
    const data = {};
    Object.entries(fields).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el && el.value.trim()) data[key] = el.value.trim();
    });
    try {
      const result = await API.saveConfig(data);
      if (result.success) {
        status.textContent = '✓ Saved — ' + (result.saved || []).length + ' values updated';
        status.style.color = 'var(--green)';
        showToast('✅', 'Integration settings saved');
        // Clear key fields for security
        ['si-jellyseerr-key','si-radarr-key','si-sonarr-key','si-tmdb','si-anthropic'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = '';
        });
      } else {
        status.textContent = '✗ ' + (result.error || 'Save failed');
        status.style.color = 'var(--red)';
      }
    } catch(e) {
      status.textContent = '✗ ' + e.message;
      status.style.color = 'var(--red)';
    }
    saveBtn.textContent = '💾 Save Integrations'; saveBtn.disabled = false;
    setTimeout(() => { status.textContent = ''; }, 5000);
  });

  // Test connection buttons
  const tests = [
    ['si-test-jellyseerr','jellyseerr'],['si-test-radarr','radarr'],
    ['si-test-sonarr','sonarr'],['si-test-tmdb','tmdb'],
    ['si-test-anthropic','anthropic'],['si-test-discord','discord'],
  ];
  tests.forEach(([btnId, service]) => {
    const btn = document.getElementById(btnId); if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.textContent = '⏳'; btn.disabled = true;
      try {
        const r = await API.get('/api/integrations/test?service=' + service);
        if (r.ok) { btn.textContent = '✓ ' + (r.message || 'OK'); btn.style.color = 'var(--green)'; }
        else { btn.textContent = '✗ ' + (r.error || 'Failed'); btn.style.color = 'var(--red)'; }
      } catch(e) { btn.textContent = '✗ Error'; btn.style.color = 'var(--red)'; }
      btn.disabled = false;
      setTimeout(() => { btn.textContent = 'Test ' + service.charAt(0).toUpperCase() + service.slice(1); btn.style.color = ''; }, 5000);
    });
  });
}

function initLayoutMode() {
  const modeSelect = document.getElementById('s-mode');
  const layoutSelect = document.getElementById('s-layout');
  const savedMode = localStorage.getItem('cf-mode') || 'advanced';
  const savedLayout = localStorage.getItem('cf-layout') || 'desktop';
  if (modeSelect) modeSelect.value = savedMode;
  if (layoutSelect) layoutSelect.value = savedLayout;
  applyLayoutMode(savedMode, savedLayout);
  if (modeSelect) modeSelect.addEventListener('change', () => { localStorage.setItem('cf-mode', modeSelect.value); applyLayoutMode(modeSelect.value, layoutSelect ? layoutSelect.value : 'desktop'); playSound('click'); });
  if (layoutSelect) layoutSelect.addEventListener('change', () => { localStorage.setItem('cf-layout', layoutSelect.value); applyLayoutMode(modeSelect ? modeSelect.value : 'advanced', layoutSelect.value); playSound('click'); });
}

function applyLayoutMode(mode, layout) {
  const app = document.getElementById('app');
  app.setAttribute('data-mode', mode);
  if (layout === 'tv' || layout === 'mobile') app.setAttribute('data-layout', layout);
  else app.removeAttribute('data-layout');
}

// ── Seasons overlay ──
function initSeasonOverlay() {
  const overlay = document.getElementById('seasons-overlay');
  if (!overlay) return;
  document.getElementById('seasons-close').addEventListener('click', () => { overlay.classList.remove('open'); playSound('click'); });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
}

// ── Onboarding ──
function initOnboarding() {
  const ob = document.getElementById('onboarding');
  if (!ob) return;
  if (localStorage.getItem('cf-onboarded')) return;
  ob.style.display = 'block';
  ob.querySelectorAll('.theme-swatch').forEach(el => {
    el.addEventListener('click', () => { ob.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active')); el.classList.add('active'); applyTheme(el.dataset.theme); });
  });
  ob.querySelectorAll('.ob-layout-btn').forEach(el => {
    el.addEventListener('click', () => {
      ob.querySelectorAll('.ob-layout-btn').forEach(b => { b.style.border='1px solid var(--border2)'; b.style.background=''; });
      el.style.border='1px solid var(--border)'; el.style.background='var(--subtle)';
      localStorage.setItem('cf-layout', el.dataset.layout);
      applyLayoutMode(localStorage.getItem('cf-mode')||'advanced', el.dataset.layout);
    });
  });
  ob.querySelectorAll('.ob-mode-btn').forEach(el => {
    el.addEventListener('click', () => {
      ob.querySelectorAll('.ob-mode-btn').forEach(b => { b.style.border='1px solid var(--border2)'; b.style.background=''; });
      el.style.border='1px solid var(--border)'; el.style.background='var(--subtle)';
      localStorage.setItem('cf-mode', el.dataset.mode);
      applyLayoutMode(el.dataset.mode, localStorage.getItem('cf-layout')||'desktop');
    });
  });
  // Pre-fill saved values
  const obFields = {
    'ob-jellyseerr-url': 'cf-jellyseerr-url', 'ob-jellyseerr-key': 'cf-jellyseerr-key',
    'ob-radarr-url': 'cf-radarr-url', 'ob-radarr-key': 'cf-radarr-key',
    'ob-sonarr-url': 'cf-sonarr-url', 'ob-sonarr-key': 'cf-sonarr-key',
    'ob-discord': 'cf-discord', 'ob-tmdb': 'cf-tmdb', 'ob-anthropic': 'cf-anthropic',
  };
  Object.entries(obFields).forEach(([fieldId, storageKey]) => {
    const el = document.getElementById(fieldId);
    if (el) {
      const saved = localStorage.getItem(storageKey);
      if (saved) el.value = saved;
      el.addEventListener('input', () => localStorage.setItem(storageKey, el.value));
    }
  });

  const obDoneBtn = document.getElementById('ob-done');
  obDoneBtn.addEventListener('click', async () => {
    obDoneBtn.textContent = 'Saving…'; obDoneBtn.disabled = true;
    // Collect all values
    const configData = {
      JELLYFIN_URL: (document.getElementById('ob-jellyfin-url') || {}).value || '',
      TMDB_API_KEY: (document.getElementById('ob-tmdb') || {}).value || '',
      ANTHROPIC_API_KEY: (document.getElementById('ob-anthropic') || {}).value || '',
      JELLYSEERR_URL: (document.getElementById('ob-jellyseerr-url') || {}).value || '',
      JELLYSEERR_API_KEY: (document.getElementById('ob-jellyseerr-key') || {}).value || '',
      RADARR_URL: (document.getElementById('ob-radarr-url') || {}).value || '',
      RADARR_API_KEY: (document.getElementById('ob-radarr-key') || {}).value || '',
      SONARR_URL: (document.getElementById('ob-sonarr-url') || {}).value || '',
      SONARR_API_KEY: (document.getElementById('ob-sonarr-key') || {}).value || '',
      DISCORD_WEBHOOK_URL: (document.getElementById('ob-discord') || {}).value || '',
    };
    // Filter out empty values
    Object.keys(configData).forEach(k => { if (!configData[k]) delete configData[k]; });
    try {
      if (Object.keys(configData).length > 0) {
        await API.saveConfig(configData);
      }
    } catch(e) {
      // If save fails (e.g. not logged in yet), that's fine — they can set in settings later
      console.warn('Config save failed:', e.message);
    }
    localStorage.setItem('cf-onboarded','1');
    ob.style.display='none';
    obDoneBtn.textContent = 'Get Started →'; obDoneBtn.disabled = false;
  });
}

// ── Metadata editor ──
let currentEditItem = null;
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
  document.getElementById('me-genres').value = (item.genres || (item.genre ? [item.genre] : [])).join(', ');
  document.getElementById('ai-suggestions').classList.remove('visible');
  document.getElementById('meta-status').textContent = '';
  document.getElementById('meta-editor').classList.add('open');
  playSound('open');
}

async function saveMetadata() {
  if (!currentEditItem) return;
  const status = document.getElementById('meta-status'); status.textContent = 'Saving…';
  try {
    await API.libUpdateItem(currentEditItem.id || currentEditItem.Id, {
      Name: document.getElementById('me-title').value,
      ProductionYear: parseInt(document.getElementById('me-year').value)||null,
      Overview: document.getElementById('me-overview').value,
      Taglines: [document.getElementById('me-tagline').value].filter(Boolean),
      OfficialRating: document.getElementById('me-rating').value,
      Genres: document.getElementById('me-genres').value.split(',').map(g=>g.trim()).filter(Boolean),
    });
    status.textContent = '✓ Saved'; showToast('✅', 'Metadata saved');
  } catch(e) { status.textContent = '✗ ' + e.message; }
}

async function reScrapeMetadata() {
  if (!currentEditItem) return;
  const status = document.getElementById('meta-status'); status.textContent = 'Re-scraping…';
  try { await API.libRefreshMeta(currentEditItem.id || currentEditItem.Id); status.textContent = '✓ Re-scrape triggered'; }
  catch(e) { status.textContent = '✗ ' + e.message; }
}

async function aiFixMetadata() {
  if (!currentEditItem) return;
  const btn = document.getElementById('meta-ai');
  const status = document.getElementById('meta-status');
  btn.classList.add('running'); btn.textContent = '⏳ Thinking…'; status.textContent = 'Asking AI…';
  try {
    const d = await API.libAiFix(currentEditItem.id || currentEditItem.Id);
    if (!d.success) { status.textContent = '✗ ' + (d.error||'AI error'); return; }
    const s = d.suggestion;
    document.getElementById('ai-suggestions').classList.add('visible');
    if (s.overview) { document.getElementById('ai-overview-wrap').style.display=''; document.getElementById('ai-overview-text').textContent=s.overview; }
    if (s.tagline) { document.getElementById('ai-tagline-wrap').style.display=''; document.getElementById('ai-tagline-text').textContent=s.tagline; }
    document.getElementById('ai-issues').innerHTML = (s.issues||[]).map(i=>`<div class="ai-issue">⚠ ${i}</div>`).join('');
    status.textContent = `AI: ${(s.issues||[]).length} issues (${Math.round((s.confidence||0)*100)}% confidence)`;
  } catch(e) { status.textContent = '✗ ' + e.message; }
  btn.classList.remove('running'); btn.textContent = '🤖 AI Fix';
}

init();
