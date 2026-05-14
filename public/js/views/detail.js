import API from '../api.js';
import { playSound, showToast } from '../themes.js';

let currentDetailItem = null;

export function initDetail() {
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('detail-modal').addEventListener('click', e => { if (e.target.id === 'detail-modal') closeDetail(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    if (currentDetailItem) window.dispatchEvent(new CustomEvent('open-meta-editor', { detail: { item: currentDetailItem } }));
  });
  document.getElementById('detail-play-btn').addEventListener('click', () => {
    if (!currentDetailItem) return;
    playSound('play');
    closeDetail();
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'player' } }));
    window.dispatchEvent(new CustomEvent('play-item', { detail: { item: currentDetailItem } }));
  });
}

export function openDetail(item) {
  if (!item) return;
  currentDetailItem = item;
  document.getElementById('detail-modal').classList.add('open');

  // Render immediately with what we have
  renderBasic(item);

  // Load full data
  API.item(item.id).then(full => {
    if (!document.getElementById('detail-modal').classList.contains('open')) return;
    currentDetailItem = full;
    renderFull(full);
  }).catch(() => {});
}

function renderBasic(item) {
  // Backdrop
  setBackdrop(item.backdropUrl || item.posterUrl);
  // Poster thumb
  const thumb = document.getElementById('detail-poster-thumb');
  if (thumb) { thumb.src = item.posterUrl || ''; thumb.onerror = () => thumb.style.opacity = '0.2'; }
  // Logo
  setLogo(item.logoUrl);
  // Text fields
  set('detail-type', item.type === 'Episode'
    ? `${item.seriesName || ''} · S${String(item.parentIndexNumber||0).padStart(2,'0')}E${String(item.indexNumber||0).padStart(2,'0')}`
    : (item.type || 'Movie'));
  set('detail-title', item.logoUrl ? '' : (item.title || ''));
  set('detail-tagline', item.tagline || '');
  set('detail-overview', item.overview || '');
  set('detail-crew', item.director ? `Directed by ${item.director}` : '');
  renderChips(item);
  renderCast(item.cast || []);
  // Play button
  const pb = document.getElementById('detail-play-btn');
  if (pb) pb.style.display = (item.type === 'Movie' || item.type === 'Episode') ? '' : 'none';
  // Clear dynamic sections
  clearSection('detail-extras');
  clearSection('detail-integrations');
}

function renderFull(full) {
  // Update backdrop with best available
  if (full.backdropUrls && full.backdropUrls.length) {
    setBackdrop(full.backdropUrls[0]);
    if (full.backdropUrls.length > 1) renderBackdropDots(full.backdropUrls);
  }
  // Poster thumb (high res)
  const thumb = document.getElementById('detail-poster-thumb');
  if (thumb && full.posterUrl) thumb.src = full.posterUrl;
  // Logo
  setLogo(full.logoUrl);
  set('detail-title', full.logoUrl ? '' : (full.title || ''));
  if (full.overview) set('detail-overview', full.overview);
  if (full.tagline) set('detail-tagline', full.tagline);
  if (full.director) set('detail-crew', `Directed by ${full.director}`);
  renderChips(full);
  renderCast(full.cast || []);
  // Extras
  if (full.extras && full.extras.length) renderExtras(full.extras);
  // Integrations
  renderIntegrations(full);
}

function setBackdrop(url) {
  const bd = document.getElementById('detail-backdrop');
  if (bd && url) bd.style.backgroundImage = `url('${url}')`;
}

function setLogo(url) {
  const logo = document.getElementById('detail-logo');
  if (!logo) return;
  if (url) { logo.src = url; logo.classList.add('visible'); }
  else logo.classList.remove('visible');
}

function set(id, val) {
  const el = document.getElementById(id); if (el) el.textContent = val;
}

function clearSection(id) {
  const el = document.getElementById(id); if (el) el.remove();
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
  if (item.audio) add('🔊 ' + item.audio, ['Atmos','DTS:X','TrueHD','DTS-HD MA'].includes(item.audio) ? 'chip-a' : 'chip-p');
  if (item.versionCount > 1) add('📀 ' + item.versionCount + ' versions', 'chip-p');
  if (item.runtime) { const m = Math.round(item.runtime / 600000000); add(Math.floor(m/60) + 'h ' + (m%60) + 'm', 'chip-p'); }
  if (item.studios && item.studios.length) add(item.studios[0], 'chip-p');
}

function renderCast(cast) {
  const grid = document.getElementById('detail-cast'); if (!grid) return;
  const label = document.getElementById('detail-cast-label');
  grid.innerHTML = '';
  if (!cast.length) { if (label) label.style.display = 'none'; return; }
  if (label) label.style.display = '';
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
    grid.appendChild(wrap);
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
  urls.slice(0, 6).forEach((url, i) => {
    const dot = document.createElement('div'); dot.className = 'backdrop-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => {
      setBackdrop(url);
      dots.querySelectorAll('.backdrop-dot').forEach((d, j) => d.classList.toggle('active', j === i));
    });
    dots.appendChild(dot);
  });
}

function renderExtras(extras) {
  const body = document.getElementById('detail-body'); if (!body || !extras.length) return;
  const section = document.createElement('div'); section.id = 'detail-extras'; section.style.marginTop = '24px';
  section.innerHTML = '<div class="detail-section-label" style="margin-bottom:10px">Extras & Special Features</div>';
  const row = document.createElement('div'); row.className = 'extras-row';
  extras.forEach(extra => {
    const item = document.createElement('div'); item.className = 'extra-item';
    item.addEventListener('click', () => {
      playSound('play');
      closeDetail();
      window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'player' } }));
      window.dispatchEvent(new CustomEvent('play-item', { detail: { item: extra } }));
    });
    const thumb = document.createElement('div'); thumb.className = 'extra-thumb-wrap';
    thumb.style.cssText = 'width:160px;height:90px;border-radius:var(--radius);overflow:hidden;background:var(--bg3);position:relative;flex-shrink:0';
    if (extra.thumbUrl) {
      const img = document.createElement('img');
      img.style.cssText = 'width:100%;height:100%;object-fit:cover';
      img.src = extra.thumbUrl;
      thumb.appendChild(img);
    }
    // Play overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);opacity:0;transition:opacity 0.2s';
    overlay.innerHTML = '<div style="font-size:24px">▶</div>';
    thumb.appendChild(overlay);
    thumb.addEventListener('mouseover', () => overlay.style.opacity = '1');
    thumb.addEventListener('mouseout', () => overlay.style.opacity = '0');
    const title = document.createElement('div'); title.className = 'extra-title'; title.textContent = extra.title || '';
    const type = document.createElement('div'); type.className = 'extra-type'; type.textContent = extra.type || 'Extra';
    item.appendChild(thumb); item.appendChild(title); item.appendChild(type);
    row.appendChild(item);
  });
  section.appendChild(row); body.appendChild(section);
}

function renderIntegrations(item) {
  const body = document.getElementById('detail-body'); if (!body) return;
  API.integrationsConfig().then(cfg => {
    const section = document.createElement('div'); section.id = 'detail-integrations';
    section.style.cssText = 'margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;padding-top:16px;border-top:1px solid var(--border2)';
    if (cfg.jellyseerr && item.type === 'Movie') {
      const btn = document.createElement('button'); btn.className = 'action-btn action-btn-secondary';
      btn.innerHTML = '📋 Request'; btn.style.fontSize = '10px';
      btn.addEventListener('click', async () => {
        btn.textContent = '⏳'; btn.disabled = true;
        try { const r = await API.requestMedia('movie', item.id); showToast(r.success ? '✅' : '⚠️', r.success ? 'Requested!' : 'Request failed'); btn.textContent = r.success ? '✓ Requested' : '✗ Failed'; }
        catch(e) { btn.textContent = '✗ Error'; btn.disabled = false; }
      });
      section.appendChild(btn);
    }
    if (cfg.discord) {
      const btn = document.createElement('button'); btn.className = 'action-btn action-btn-secondary';
      btn.innerHTML = '📢 Share'; btn.style.fontSize = '10px';
      btn.addEventListener('click', async () => {
        btn.textContent = '⏳'; btn.disabled = true;
        try { await API.discordNotify({ title: item.title, overview: item.overview, posterUrl: item.posterUrl, type: item.type, year: item.year }); showToast('✅', 'Shared!'); btn.textContent = '✓ Shared'; }
        catch(e) { btn.textContent = '✗ Error'; btn.disabled = false; }
      });
      section.appendChild(btn);
    }
    if (window._jellyfinUrl) {
      const a = document.createElement('a'); a.className = 'action-btn action-btn-secondary';
      a.href = window._jellyfinUrl + '/web/#/details?id=' + item.id; a.target = '_blank';
      a.innerHTML = '↗ Open in Jellyfin'; a.style.cssText = 'font-size:10px;text-decoration:none';
      section.appendChild(a);
    }
    if (section.children.length) body.appendChild(section);
  }).catch(() => {});
}

export function closeDetail() {
  document.getElementById('detail-modal').classList.remove('open');
  // Reset backdrop dots
  const dots = document.getElementById('detail-backdrop-dots'); if (dots) dots.innerHTML = '';
  clearSection('detail-extras');
  clearSection('detail-integrations');
  const logo = document.getElementById('detail-logo'); if (logo) logo.classList.remove('visible');
  currentDetailItem = null;
}

export function getCurrentDetailItem() { return currentDetailItem; }
