import API from '../api.js';
import { playSound } from '../themes.js';
import { openDetail } from './detail.js';
import { mkCard } from './home.js';

let showsStart = 0, showsTotal = 0, showsLoading = false;

export function initShows() {
  document.getElementById('shows-sort').addEventListener('change', () => loadShows());
  document.getElementById('shows-order').addEventListener('change', () => loadShows());
  document.getElementById('shows-genre').addEventListener('change', () => loadShows());
  document.getElementById('shows-more').addEventListener('click', () => loadShows(true));
  document.getElementById('view-shows').addEventListener('scroll', () => {
    const el = document.getElementById('view-shows');
    const btn = document.getElementById('shows-more');
    if (!showsLoading && btn.style.display !== 'none' && el.scrollTop + el.clientHeight >= el.scrollHeight - 300) loadShows(true);
  });
  loadGenreFilter('shows-genre', 'Series');
}

export async function loadShows(append = false) {
  if (showsLoading) return;
  if (!append) { showsStart = 0; showsTotal = 0; document.getElementById('shows-grid').innerHTML = ''; }
  showsLoading = true;
  try {
    const sort = document.getElementById('shows-sort').value;
    const order = document.getElementById('shows-order').value;
    const genre = document.getElementById('shows-genre').value;
    const data = await API.shows({ sort, order, genre, start: showsStart });
    showsTotal = data.total || 0;
    showsStart += (data.items || []).length;
    const countEl = document.getElementById('shows-count');
    if (countEl) countEl.textContent = showsTotal.toLocaleString() + ' shows';
    const grid = document.getElementById('shows-grid');
    if (!append) grid.innerHTML = '';
    (data.items || []).forEach(item => {
      const card = mkCard(item);
      // Override click to open seasons
      const existingListener = card._clickFn;
      card.replaceWith(card.cloneNode(true));
      // Re-add with seasons open
      const newCard = mkCard(item);
      newCard.addEventListener('click', () => { openShowSeasons(item); playSound('open'); }, { capture: true });
      // Remove the default openDetail listener added by mkCard
      grid.appendChild(newCard);
    });
    const btn = document.getElementById('shows-more');
    btn.style.display = showsStart < showsTotal ? '' : 'none';
  } catch(e) {} finally { showsLoading = false; }
}

async function loadGenreFilter(selectId, type) {
  try {
    const genres = await API.genres(type);
    const sel = document.getElementById(selectId); if (!sel) return;
    sel.innerHTML = '<option value="">All Genres</option>';
    genres.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; sel.appendChild(o); });
  } catch(e) {}
}

// Seasons overlay
export async function openShowSeasons(showItem) {
  const overlay = document.getElementById('seasons-overlay');
  const title = document.getElementById('seasons-title');
  const content = document.getElementById('seasons-content');
  if (!overlay) return;
  if (title) title.textContent = showItem.title || '';
  content.innerHTML = '<div class="loading-spinner"></div>';
  overlay.style.display = 'flex'; requestAnimationFrame(() => overlay.classList.add('open'));
  try {
    const seasons = await API.seasons(showItem.id);
    content.innerHTML = '';
    const grid = document.createElement('div'); grid.className = 'card-grid';
    seasons.forEach(season => {
      const card = mkCard(season);
      card.addEventListener('click', (e) => { e.stopPropagation(); openSeasonEpisodes(showItem, season); });
      grid.appendChild(card);
    });
    content.appendChild(grid);
  } catch(e) { content.innerHTML = '<div class="empty-state">Failed to load seasons</div>'; }
}

async function openSeasonEpisodes(show, season) {
  const content = document.getElementById('seasons-content');
  content.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const episodes = await API.episodes(show.id, season.id);
    content.innerHTML = '';
    // Back button
    const back = document.createElement('button'); back.className = 'back-btn'; back.style.margin = '0 0 16px';
    back.textContent = '← ' + (show.title || '');
    back.addEventListener('click', () => openShowSeasons(show));
    content.appendChild(back);
    const header = document.createElement('div'); header.style.cssText = 'font-family:var(--font-display);font-size:14px;letter-spacing:0.3em;color:var(--accent);opacity:0.6;margin-bottom:16px;padding:0 4px';
    header.textContent = season.title || 'Season';
    content.appendChild(header);
    const list = document.createElement('div'); list.style.cssText = 'display:flex;flex-direction:column;gap:8px';
    episodes.forEach(ep => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px;align-items:center;padding:10px 12px;background:var(--subtle);border:1px solid var(--border2);border-radius:var(--radius);cursor:pointer;transition:border-color 0.2s';
      row.addEventListener('mouseover', () => row.style.borderColor = 'var(--border)');
      row.addEventListener('mouseout', () => row.style.borderColor = 'var(--border2)');
      const num = document.createElement('div'); num.style.cssText = 'font-family:var(--font-display);font-size:18px;color:var(--accent);opacity:0.4;width:36px;flex-shrink:0;text-align:center';
      num.textContent = ep.indexNumber || '?';
      const info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0';
      const epTitle = document.createElement('div'); epTitle.style.cssText = 'font-size:12px;font-weight:700;color:var(--cream);opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      epTitle.textContent = ep.title || '';
      const epMeta = document.createElement('div'); epMeta.style.cssText = 'font-size:10px;color:var(--muted);margin-top:2px';
      epMeta.textContent = ep.overview ? ep.overview.slice(0, 80) + (ep.overview.length > 80 ? '…' : '') : '';
      const prog = ep.userData && ep.userData.PlayedPercentage > 0 && ep.userData.PlayedPercentage < 100;
      if (prog) {
        const bar = document.createElement('div'); bar.style.cssText = 'height:2px;background:rgba(255,255,255,0.1);border-radius:1px;margin-top:4px;overflow:hidden';
        const fill = document.createElement('div'); fill.style.cssText = 'height:100%;background:var(--accent);width:' + ep.userData.PlayedPercentage + '%';
        bar.appendChild(fill); info.appendChild(bar);
      }
      info.appendChild(epTitle); info.appendChild(epMeta);
      const playBtn = document.createElement('button'); playBtn.className = 'action-btn action-btn-primary'; playBtn.style.cssText = 'font-size:9px;padding:7px 12px;flex-shrink:0';
      playBtn.textContent = '▶ Play';
      playBtn.addEventListener('click', e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('play-item', { detail: { item: ep } })); });
      row.addEventListener('click', () => openDetail(ep));
      row.appendChild(num); row.appendChild(info); row.appendChild(playBtn);
      list.appendChild(row);
    });
    content.appendChild(list);
  } catch(e) { content.innerHTML = '<div class="empty-state">Failed to load episodes</div>'; }
}
