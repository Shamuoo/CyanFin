import API from '../api.js';
import { playSound, get as getSetting, showToast } from '../themes.js';
import { openDetail } from './detail.js';

let heroItems = [], heroIdx = 0, heroTimer = null;
let ssItems = [], ssIdx = 0, ssActive = false, ssTimer = null, ssProgTimer = null;

export function initHome() {
  initScreensaver();
}

// ── Hero ──
export function updateHero(item) {
  if (!item) return;
  const bg = document.getElementById('hero-bg');
  if (bg) bg.style.backgroundImage = `url('${item.backdropUrl || item.posterUrl}')`;
  const titleEl = document.getElementById('hero-title');
  if (titleEl) titleEl.textContent = item.title || '';
  const metaEl = document.getElementById('hero-meta');
  if (metaEl) metaEl.textContent = [item.year, item.genre, item.rating, item.score ? `★ ${parseFloat(item.score).toFixed(1)}` : ''].filter(Boolean).join(' · ');
  const labelEl = document.getElementById('hero-label');
  if (labelEl) labelEl.textContent = (item.qualities && item.qualities.length) ? item.qualities.join(' · ') : 'Recently Added';
}

export function startHeroCycle(items) {
  heroItems = items.filter(i => i.backdropUrl || i.posterUrl);
  heroIdx = 0;
  clearInterval(heroTimer);
  if (heroItems.length < 2) return;
  heroTimer = setInterval(() => {
    heroIdx = (heroIdx + 1) % heroItems.length;
    updateHero(heroItems[heroIdx]);
  }, 8000);
}

// ── Sections ──
export async function renderHomeSections() {
  const container = document.getElementById('home-sections');
  if (!container) return;

  const sections = [
    { key: 'continue',  label: 'Continue Watching',   fn: () => API.continueWatching() },
    { key: 'recent',    label: 'Recently Added',       fn: () => API.recentlyAdded() },
    { key: 'popular',   label: 'Most Popular',         fn: () => API.popular() },
    { key: 'history',   label: 'Watch History',        fn: () => API.history() },
    { key: 'best3d',    label: '🎬 Best in 3D',        fn: () => API.best3D() },
    { key: 'onthisday', label: 'On This Day',          fn: () => API.onThisDay() },
    { key: 'coming',    label: 'Coming Soon',          fn: () => API.comingSoon() },
    { key: 'random',    label: '🎲 Feeling Lucky',     fn: async () => { const r = await API.random(); return r ? [r] : []; } },
  ];

  container.innerHTML = '';
  let allItems = [];

  for (const sec of sections) {
    const secEl = document.createElement('div'); secEl.className = 'section';
    secEl.innerHTML = `<div class="section-header"><div class="section-title">${sec.label}</div></div><div class="card-row" id="row-${sec.key}"></div>`;
    container.appendChild(secEl);
    try {
      const items = await sec.fn();
      const row = document.getElementById('row-' + sec.key);
      if (!items || !items.length) { secEl.style.display = 'none'; continue; }
      items.forEach(item => row.appendChild(mkCard(item)));
      allItems.push(...items);
      if (sec.key === 'recent') {
        ssItems = items.filter(i => i.backdropUrl || i.posterUrl);
        startHeroCycle(items);
        updateHero(items[0]);
      }
    } catch(e) { secEl.style.display = 'none'; }
  }
  buildTicker(allItems);
}

// ── Ticker ──
function buildTicker(items) {
  const inner = document.getElementById('hero-ticker-inner');
  if (!inner || !items.length) return;
  const seen = new Set();
  const unique = items.filter(i => { if (!i.id || seen.has(i.id)) return false; seen.add(i.id); return true; });
  const all = [...unique, ...unique];
  inner.innerHTML = all.map(item =>
    `<div class="ticker-item" data-id="${item.id}">
      <img class="ticker-item-poster" src="${item.posterUrl || ''}" alt="" onerror="this.style.display='none'" />
      <div><div class="ticker-item-title">${item.title || ''}</div>
      <div class="ticker-item-meta">${[item.year, item.qualities && item.qualities[0]].filter(Boolean).join(' · ')}</div></div>
    </div>`
  ).join('');
  const itemMap = {};
  unique.forEach(i => itemMap[i.id] = i);
  inner.querySelectorAll('.ticker-item').forEach(el => {
    el.addEventListener('click', () => { const item = itemMap[el.dataset.id]; if (item) { openDetail(item); playSound('open'); } });
  });
}

// ── Cards ──
export function mkCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  card.addEventListener('click', () => { openDetail(item); playSound('open'); });

  const wrap = document.createElement('div'); wrap.className = 'card-img-wrap'; wrap.style.pointerEvents = 'none';

  const img = document.createElement('img'); img.className = 'card-img';
  img.src = item.posterUrl || ''; img.alt = item.title || '';
  img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
  wrap.appendChild(img);

  const ph = document.createElement('div'); ph.className = 'card-ph'; ph.textContent = 'NO IMG';
  if (item.posterUrl) ph.style.display = 'none';
  wrap.appendChild(ph);

  if (item.qualities && item.qualities.length) {
    const badges = document.createElement('div'); badges.className = 'badges';
    item.qualities.forEach(q => {
      const b = document.createElement('div');
      b.className = 'badge ' + (q.includes('3D') ? 'badge-3d' : q.startsWith('4K') ? 'badge-4k' : q.includes('1080') ? 'badge-1080' : 'badge-720');
      b.textContent = q; badges.appendChild(b);
    });
    wrap.appendChild(badges);
  }
  if (item.audio) { const ab = document.createElement('div'); ab.className = 'badge-audio'; ab.textContent = item.audio; wrap.appendChild(ab); }
  if (item.versionCount > 1) { const vb = document.createElement('div'); vb.className = 'badge-ver'; vb.textContent = '×' + item.versionCount; wrap.appendChild(vb); }
  if (item.userData && item.userData.PlayedPercentage > 0 && item.userData.PlayedPercentage < 100) {
    const pb = document.createElement('div'); pb.className = 'card-progress';
    const pf = document.createElement('div'); pf.className = 'card-progress-fill'; pf.style.width = item.userData.PlayedPercentage + '%';
    pb.appendChild(pf); wrap.appendChild(pb);
  }

  card.appendChild(wrap);
  const title = document.createElement('div'); title.className = 'card-title';
  title.textContent = (item.type === 'Episode' && item.seriesName) ? item.seriesName : (item.title || '');
  card.appendChild(title);
  const meta = document.createElement('div'); meta.className = 'card-meta';
  meta.textContent = [item.year, item.score ? '★' + parseFloat(item.score).toFixed(1) : ''].filter(Boolean).join(' · ');
  card.appendChild(meta);
  return card;
}

// ── Stats strip ──
export async function loadStats() {
  try {
    const d = await API.stats();
    document.querySelectorAll('.stat-movies').forEach(el => el.textContent = (d.movies || 0).toLocaleString());
    document.querySelectorAll('.stat-shows').forEach(el => el.textContent = (d.shows || 0).toLocaleString());
    document.querySelectorAll('.stat-episodes').forEach(el => el.textContent = (d.episodes || 0).toLocaleString());
    document.querySelectorAll('.stat-songs').forEach(el => el.textContent = (d.songs || 0).toLocaleString());
  } catch(e) {}
}

// ── Weather ──
export async function loadWeather() {
  if (!getSetting('weather')) return;
  const city = getSetting('city') || 'Brisbane';
  try {
    const d = await API.weather(city);
    if (!d) return;
    const icons = {113:'☀️',116:'⛅',119:'☁️',122:'☁️',143:'🌫️',176:'🌦️',200:'⛈️',227:'🌨️',230:'❄️',263:'🌧️',296:'🌧️',302:'🌧️',308:'🌧️',356:'⛈️',386:'⛈️'};
    const icon = icons[d.code] || '🌤️';
    const temp = getSetting('units') === 'F' ? d.tempF + '°F' : d.temp + '°C';
    const el = document.getElementById('weather-icon'); if (el) el.textContent = icon;
    const te = document.getElementById('weather-temp'); if (te) te.textContent = temp;
    const de = document.getElementById('weather-desc'); if (de) de.textContent = d.desc;
    const pill = document.getElementById('weather-pill'); if (pill) pill.style.display = '';
  } catch(e) {}
}

// ── Screensaver ──
function initScreensaver() {
  const ss = document.getElementById('screensaver');
  if (ss) ss.addEventListener('click', stopSS);
  document.addEventListener('mousemove', resetSS);
  document.addEventListener('touchstart', resetSS);
  document.addEventListener('keydown', resetSS);
  resetSS();
}

export function resetSS() {
  stopSS();
  if (!getSetting('ss') || !ssItems.length) return;
  clearTimeout(ssTimer);
  ssTimer = setTimeout(startSS, (getSetting('ssDelay') || 300) * 1000);
}

function startSS() {
  const currentView = document.querySelector('.view.active');
  if (currentView && (currentView.id === 'view-player' || currentView.id === 'view-login')) return;
  ssActive = true;
  document.getElementById('screensaver').classList.add('visible');
  showSSSlide();
}

function stopSS() {
  ssActive = false;
  const ss = document.getElementById('screensaver');
  if (ss) ss.classList.remove('visible');
  clearInterval(ssProgTimer);
  const bar = document.getElementById('ss-bar'); if (bar) bar.style.width = '0%';
}

function showSSSlide() {
  if (!ssActive || !ssItems.length) return;
  const item = ssItems[ssIdx % ssItems.length];
  const bg = document.getElementById('ss-bg'); if (bg) bg.style.backgroundImage = item.backdropUrl ? `url('${item.backdropUrl}')` : '';
  const t = document.getElementById('ss-title'); if (t) t.textContent = item.title || '';
  const m = document.getElementById('ss-meta'); if (m) m.textContent = [item.year, item.genre].filter(Boolean).join(' · ');
  const o = document.getElementById('ss-overview'); if (o) o.textContent = item.overview || '';
  let pct = 0; clearInterval(ssProgTimer);
  const delay = 12000;
  ssProgTimer = setInterval(() => {
    pct += 100 / (delay / 100);
    const bar = document.getElementById('ss-bar'); if (bar) bar.style.width = Math.min(pct, 100) + '%';
  }, 100);
  setTimeout(() => { ssIdx = (ssIdx + 1) % ssItems.length; if (ssActive) showSSSlide(); }, delay);
}
