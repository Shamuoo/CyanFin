import API from '../api.js';
import { playSound, showToast } from '../themes.js';

let currentDetailItem = null;

export function initDetail() {
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('detail-modal').addEventListener('click', e => { if (e.target.id === 'detail-modal') closeDetail(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
  document.getElementById('detail-edit-btn').addEventListener('click', () => { if (currentDetailItem) openMetaEditor(currentDetailItem); });
}

export function openDetail(item) {
  if (!item) return;
  currentDetailItem = item;
  const modal = document.getElementById('detail-modal');
  modal.classList.add('open');

  // Immediate render with available data
  renderDetailBasic(item);

  // Load full data async
  API.item(item.id).then(full => {
    if (!document.getElementById('detail-modal').classList.contains('open')) return;
    currentDetailItem = full;
    renderDetailFull(full);
  }).catch(() => {});
}

function renderDetailBasic(item) {
  const backdrop = document.getElementById('detail-backdrop');
  if (backdrop) backdrop.style.backgroundImage = `url('${item.backdropUrl || item.posterUrl}')`;
  const poster = document.getElementById('detail-poster');
  if (poster) poster.src = item.posterUrl || '';
  const logo = document.getElementById('detail-logo');
  if (logo) { logo.classList.remove('visible'); if (item.logoUrl) { logo.src = item.logoUrl; logo.classList.add('visible'); } }
  const titleEl = document.getElementById('detail-title'); if (titleEl) titleEl.textContent = item.title || '';
  const taglineEl = document.getElementById('detail-tagline'); if (taglineEl) taglineEl.textContent = item.tagline || '';
  const overviewEl = document.getElementById('detail-overview'); if (overviewEl) overviewEl.textContent = item.overview || '';
  const typeEl = document.getElementById('detail-type');
  if (typeEl) typeEl.textContent = item.type === 'Episode'
    ? `${item.seriesName || ''} · S${String(item.parentIndexNumber||0).padStart(2,'0')}E${String(item.indexNumber||0).padStart(2,'0')}`
    : (item.type || 'Movie');
  renderChips(item);
  renderCast(item.cast || []);
  const crewEl = document.getElementById('detail-crew'); if (crewEl) crewEl.textContent = item.director ? `Directed by ${item.director}` : '';
  const playBtn = document.getElementById('detail-play-btn');
  if (playBtn) playBtn.style.display = (item.type === 'Movie' || item.type === 'Episode') ? '' : 'none';
  // Clear dynamic sections
  const extras = document.getElementById('detail-extras'); if (extras) extras.remove();
  const dots = document.getElementById('detail-backdrop-dots'); if (dots) dots.remove();
  const integrations = document.getElementById('detail-integrations'); if (integrations) integrations.remove();
}

function renderDetailFull(full) {
  // Update fields that may have more data
  const overviewEl = document.getElementById('detail-overview'); if (overviewEl && full.overview) overviewEl.textContent = full.overview;
  const taglineEl = document.getElementById('detail-tagline'); if (taglineEl && full.tagline) taglineEl.textContent = full.tagline;
  const logo = document.getElementById('detail-logo'); if (logo && full.logoUrl) { logo.src = full.logoUrl; logo.classList.add('visible'); }
  renderChips(full);
  renderCast(full.cast || []);
  const crewEl = document.getElementById('detail-crew'); if (crewEl) crewEl.textContent = full.director ? `Directed by ${full.director}` : '';
  if (full.backdropUrls && full.backdropUrls.length > 1) renderBackdropDots(full.backdropUrls);
  if (full.extras && full.extras.length) renderExtras(full.extras);
  renderIntegrations(full);
}

function renderChips(item) {
  const chips = document.getElementById('detail-chips'); if (!chips) return;
  chips.innerHTML = '';
  const add = (text, cls) => { if (!text) return; const c = document.createElement('div'); c.className = 'chip ' + cls; c.textContent = text; chips.appendChild(c); };
  add(item.year, 'chip-a');
  add(item.genre, 'chip-p');
  add(item.rating, 'chip-a');
  if (item.score) add('★ ' + parseFloat(item.score).toFixed(1), 'chip-p');
  (item.qualities || []).forEach(q => add(q, q.includes('3D') ? 'chip-3d' : q.startsWith('4K') ? 'chip-4k' : 'chip-a'));
  if (item.audio) { const isHigh = ['Atmos','DTS:X','TrueHD','DTS-HD MA'].includes(item.audio); add('🔊 ' + item.audio, isHigh ? 'chip-a' : 'chip-p'); }
  if (item.versionCount > 1) add('📀 ' + item.versionCount + ' versions', 'chip-p');
  if (item.runtime) { const mins = Math.round(item.runtime / 600000000); add(Math.floor(mins/60) + 'h ' + (mins%60) + 'm', 'chip-p'); }
  if (item.studios && item.studios.length) add(item.studios[0], 'chip-p');
}

function renderCast(cast) {
  const castGrid = document.getElementById('detail-cast'); if (!castGrid) return;
  const castLabel = document.getElementById('detail-cast-label');
  castGrid.innerHTML = '';
  if (!cast.length) { if (castLabel) castLabel.style.display = 'none'; return; }
  if (castLabel) castLabel.style.display = '';
  cast.forEach(actor => {
    const wrap = document.createElement('div'); wrap.className = 'cast-item';
    if (actor.imageTag) {
      const img = document.createElement('img'); img.className = 'cast-photo';
      img.src = `/proxy/image?id=${actor.id}&type=Primary&w=185`; img.alt = actor.name || '';
      img.onerror = () => img.replaceWith(mkPh(actor.name));
      wrap.appendChild(img);
    } else wrap.appendChild(mkPh(actor.name));
    const n = document.createElement('div'); n.className = 'cast-name'; n.textContent = actor.name || '';
    const r = document.createElement('div'); r.className = 'cast-role'; r.textContent = actor.role || '';
    wrap.appendChild(n); wrap.appendChild(r);
    castGrid.appendChild(wrap);
  });
}

function mkPh(name) {
  const el = document.createElement('div'); el.className = 'cast-ph';
  el.textContent = (name || '?')[0].toUpperCase(); return el;
}

function renderBackdropDots(urls) {
  const wrap = document.getElementById('detail-poster-wrap'); if (!wrap) return;
  let dots = document.getElementById('detail-backdrop-dots');
  if (!dots) { dots = document.createElement('div'); dots.id = 'detail-backdrop-dots'; wrap.appendChild(dots); }
  dots.innerHTML = '';
  urls.forEach((url, i) => {
    const dot = document.createElement('div'); dot.className = 'backdrop-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => {
      const bd = document.getElementById('detail-backdrop'); if (bd) bd.style.backgroundImage = `url('${url}')`;
      dots.querySelectorAll('.backdrop-dot').forEach((d, j) => d.classList.toggle('active', j === i));
    });
    dots.appendChild(dot);
  });
}

function renderExtras(extras) {
  const body = document.getElementById('detail-body'); if (!body || !extras.length) return;
  const section = document.createElement('div'); section.id = 'detail-extras'; section.style.marginTop = '20px';
  section.innerHTML = '<div class="detail-section-label" style="margin-bottom:8px">Extras</div>';
  const row = document.createElement('div'); row.className = 'extras-row';
  extras.forEach(extra => {
    const item = document.createElement('div'); item.className = 'extra-item';
    item.addEventListener('click', () => {
      playSound('play');
      window.dispatchEvent(new CustomEvent('play-item', { detail: { item: extra } }));
    });
    const thumb = document.createElement('img'); thumb.className = 'extra-thumb';
    thumb.src = extra.thumbUrl || ''; thumb.onerror = () => thumb.style.opacity = '0.3';
    const title = document.createElement('div'); title.className = 'extra-title'; title.textContent = extra.title || '';
    const type = document.createElement('div'); type.className = 'extra-type'; type.textContent = extra.type || 'Extra';
    item.appendChild(thumb); item.appendChild(title); item.appendChild(type);
    row.appendChild(item);
  });
  section.appendChild(row); body.appendChild(section);
}

function renderIntegrations(item) {
  const body = document.getElementById('detail-body'); if (!body) return;
  const section = document.createElement('div'); section.id = 'detail-integrations'; section.style.cssText = 'margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;';

  // Jellyseerr request button (for items not in library / TMDB items)
  API.integrationsConfig().then(cfg => {
    if (cfg.jellyseerr && item.type === 'Movie') {
      const btn = document.createElement('button'); btn.className = 'action-btn action-btn-secondary';
      btn.innerHTML = '📋 Request'; btn.style.fontSize = '10px';
      btn.addEventListener('click', async () => {
        btn.textContent = '⏳ Requesting…'; btn.disabled = true;
        try {
          const r = await API.requestMedia('movie', item.id);
          if (r.success) { showToast('✅', 'Requested!'); btn.textContent = '✓ Requested'; }
          else { btn.textContent = '✗ Failed'; btn.disabled = false; }
        } catch(e) { btn.textContent = '✗ Error'; btn.disabled = false; }
      });
      section.appendChild(btn);
    }
    if (cfg.discord) {
      const btn = document.createElement('button'); btn.className = 'action-btn action-btn-secondary';
      btn.innerHTML = '📢 Share'; btn.style.fontSize = '10px';
      btn.addEventListener('click', async () => {
        btn.textContent = '⏳ Sharing…'; btn.disabled = true;
        try {
          await API.discordNotify({ title: item.title, overview: item.overview, posterUrl: item.posterUrl, type: item.type, year: item.year });
          showToast('✅', 'Shared to Discord!'); btn.textContent = '✓ Shared';
        } catch(e) { btn.textContent = '✗ Error'; btn.disabled = false; }
      });
      section.appendChild(btn);
    }
    // Open in Jellyfin button
    if (window._jellyfinUrl) {
      const a = document.createElement('a'); a.className = 'action-btn action-btn-secondary';
      a.href = window._jellyfinUrl + '/web/#/details?id=' + item.id; a.target = '_blank';
      a.innerHTML = '↗ Jellyfin'; a.style.fontSize = '10px'; a.style.textDecoration = 'none';
      section.appendChild(a);
    }
    if (section.children.length) body.appendChild(section);
  }).catch(() => {});
}

export function closeDetail() {
  document.getElementById('detail-modal').classList.remove('open');
  const dots = document.getElementById('detail-backdrop-dots'); if (dots) dots.remove();
  const extras = document.getElementById('detail-extras'); if (extras) extras.remove();
  const integrations = document.getElementById('detail-integrations'); if (integrations) integrations.remove();
  const logo = document.getElementById('detail-logo'); if (logo) logo.classList.remove('visible');
  currentDetailItem = null;
}

export function getCurrentDetailItem() { return currentDetailItem; }

// Meta editor (imported by app.js)
export function openMetaEditor(item) {
  window.dispatchEvent(new CustomEvent('open-meta-editor', { detail: { item } }));
}
