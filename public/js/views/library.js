import API from '../api.js';
import { playSound, showToast } from '../themes.js';

function libLog(msg) {
  const log = document.getElementById('lib-log');
  if (log) { log.innerHTML += `<div>${new Date().toLocaleTimeString()} — ${msg}</div>`; log.scrollTop = log.scrollHeight; }
}

function setBadge(id, count) {
  const el = document.getElementById(id); if (!el) return;
  el.textContent = count;
  el.style.cssText = `padding:1px 5px;border-radius:8px;font-size:8px;font-weight:700;background:${count>0?'rgba(231,76,60,0.15)':'rgba(46,204,113,0.1)'};color:${count>0?'var(--red)':'var(--green)'}`;
}

function mkLibItem(item, badge, badgeCls, actions) {
  const el = document.createElement('div'); el.className = 'lib-item';
  const img = document.createElement('img'); img.className = 'lib-item-poster';
  img.src = item.posterUrl || ''; img.onerror = () => img.style.opacity = '0';
  const info = document.createElement('div'); info.className = 'lib-item-info';
  const t = document.createElement('div'); t.className = 'lib-item-title'; t.textContent = item.title || '';
  const m = document.createElement('div'); m.className = 'lib-item-meta';
  m.textContent = [item.year, item.quality, item.audio, item.versions && item.versions.join(' · ')].filter(Boolean).join(' · ');
  info.appendChild(t); info.appendChild(m);
  const b = document.createElement('div'); b.className = 'lib-item-badge ' + badgeCls; b.textContent = badge;
  const acts = document.createElement('div'); acts.className = 'lib-item-actions';
  (actions||[]).forEach(([label, fn]) => {
    const btn = document.createElement('button'); btn.className = 'lib-action-btn'; btn.textContent = label;
    btn.addEventListener('click', async () => { btn.disabled = true; btn.textContent = '…'; await fn(item, btn); });
    acts.appendChild(btn);
  });
  el.appendChild(img); el.appendChild(info); el.appendChild(b); el.appendChild(acts);
  return el;
}

function renderLibList(id, items, badgeFn, clsFn, actionsFn, empty) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = '';
  if (!items || !items.length) { el.innerHTML = `<div class="lib-empty">✓ ${empty||'None found'}</div>`; return; }
  items.slice(0, 30).forEach(item => el.appendChild(mkLibItem(item, badgeFn(item), clsFn(item), actionsFn(item))));
  if (items.length > 30) { const more = document.createElement('div'); more.className = 'lib-empty'; more.textContent = `+ ${items.length-30} more`; el.appendChild(more); }
}

const editAction = (item, btn) => { window.dispatchEvent(new CustomEvent('open-meta-editor', { detail: { item } })); btn.textContent = '✓'; };
const metaAction = async (item, btn) => { try { await API.libRefreshMeta(item.id); btn.textContent = '✓'; btn.classList.add('done'); libLog('Refreshed: ' + item.title); } catch(e) { btn.textContent = '✗'; } };
const imgAction = async (item, btn) => { try { await API.libRefreshImages(item.id); btn.textContent = '✓'; btn.classList.add('done'); libLog('Images: ' + item.title); } catch(e) { btn.textContent = '✗'; } };

export async function runQualityScan() {
  libLog('Scanning quality…');
  try {
    const d = await API.libQuality();
    setBadge('cnt-sd', d.sdItems.length); setBadge('cnt-upgrade', d.upgradeItems.length);
    setBadge('cnt-audio', d.poorAudioItems.length); setBadge('cnt-nostream', d.noStreamItems.length);
    renderLibList('ll-sd', d.sdItems, i=>`${i.quality||'SD'} · ${i.audio||'?'}`, ()=>'lib-badge-bad', i=>[['✏ Edit',editAction],['↻ Meta',metaAction]]);
    renderLibList('ll-upgrade', d.upgradeItems, i=>i.quality||'?', ()=>'lib-badge-warn', i=>[['✏ Edit',editAction],['↻ Meta',metaAction]]);
    renderLibList('ll-audio', d.poorAudioItems, i=>i.audio||'?', ()=>'lib-badge-warn', i=>[['✏ Edit',editAction]]);
    renderLibList('ll-nostream', d.noStreamItems, ()=>'No Stream', ()=>'lib-badge-bad', i=>[['↻ Meta',metaAction]]);
    libLog(`Quality: ${d.sdItems.length} SD, ${d.upgradeItems.length} upgrades`);
    return d;
  } catch(e) { libLog('Quality scan failed: '+e.message); return {}; }
}

export async function runMissingScan() {
  libLog('Scanning missing content…');
  try {
    const d = await API.libMissing();
    setBadge('cnt-noposter', d.missingPoster.length); setBadge('cnt-nobackdrop', d.missingBackdrop.length); setBadge('cnt-nooverview', d.missingOverview.length);
    renderLibList('ll-noposter', d.missingPoster, ()=>'No Poster', ()=>'lib-badge-bad', i=>[['✏ Edit',editAction],['🖼 Fix',imgAction],['↻ Meta',metaAction]]);
    renderLibList('ll-nobackdrop', d.missingBackdrop, ()=>'No Backdrop', ()=>'lib-badge-warn', i=>[['🖼 Fix',imgAction]]);
    renderLibList('ll-nooverview', d.missingOverview, ()=>'No Overview', ()=>'lib-badge-warn', i=>[['✏ Edit',editAction],['↻ Meta',metaAction]]);
    libLog(`Missing: ${d.missingPoster.length} posters, ${d.missingOverview.length} overviews`);
    return d;
  } catch(e) { libLog('Missing scan failed: '+e.message); return {}; }
}

export async function runVersionsScan() {
  libLog('Scanning versions…');
  try {
    const d = await API.libVersions();
    setBadge('cnt-multi', d.multiVersion.length); setBadge('cnt-3d', d.has3D.length); setBadge('cnt-2d', d.only2D.length);
    renderLibList('ll-multi', d.multiVersion, i=>`${i.count} versions`, ()=>'lib-badge-info', ()=>[], 'No multi-version movies');
    renderLibList('ll-3d', d.has3D, i=>i.versions.join(' · '), ()=>'lib-badge-good', ()=>[], 'No 3D movies');
    renderLibList('ll-2d', d.only2D, ()=>'2D only', ()=>'lib-badge-warn', ()=>[], 'All movies have 3D');
    return d;
  } catch(e) { libLog('Versions scan failed'); return {}; }
}

export async function runMusicScan() {
  libLog('Scanning music…');
  try {
    const d = await API.libMusic();
    setBadge('cnt-noart', d.missingArt.length);
    const g = document.getElementById('lib-music-grid');
    if (g) g.innerHTML = `
      <div class="h-card glass-card"><div class="h-card-title">Albums</div><div class="h-big">${d.totalAlbums}</div></div>
      <div class="h-card glass-card"><div class="h-card-title">Tracks</div><div class="h-big">${d.totalTracks}</div></div>
      <div class="h-card glass-card"><div class="h-card-title">Missing Art</div><div class="h-big ${d.missingArt.length>0?'warn':'good'}">${d.missingArt.length}</div></div>`;
    renderLibList('ll-noart', d.missingArt, ()=>'No Art', ()=>'lib-badge-warn', i=>[['🖼 Fix',imgAction]]);
    return d;
  } catch(e) { libLog('Music scan failed'); return {}; }
}

export async function runAllLibScans() {
  const [q, m, v, mu] = await Promise.all([runQualityScan(), runMissingScan(), runVersionsScan(), runMusicScan()]);
  const g = document.getElementById('lib-overview-grid'); if (!g) return;
  g.innerHTML = [
    ['SD Files', (q.sdItems||[]).length, (q.sdItems||[]).length>0?'warn':'good', 'Below quality threshold'],
    ['Upgrades', (q.upgradeItems||[]).length, (q.upgradeItems||[]).length>0?'warn':'good', 'Potential upgrades'],
    ['Poor Audio', (q.poorAudioItems||[]).length, (q.poorAudioItems||[]).length>0?'warn':'good', 'No surround sound'],
    ['No Poster', (m.missingPoster||[]).length, (m.missingPoster||[]).length>0?'bad':'good', 'Missing poster'],
    ['No Overview', (m.missingOverview||[]).length, (m.missingOverview||[]).length>0?'warn':'good', 'Missing description'],
    ['3D Movies', (v.has3D||[]).length, 'good', 'With 3D version'],
    ['Multi-Version', (v.multiVersion||[]).length, '', 'Multiple files'],
    ['Music Albums', mu.totalAlbums||0, '', (mu.totalTracks||0)+' tracks'],
  ].map(([title,count,cls,desc])=>`<div class="h-card glass-card"><div class="h-card-title">${title}</div><div class="h-big ${cls}">${count}</div><div style="font-size:9px;color:var(--muted)">${desc}</div></div>`).join('');
  libLog('Full scan complete!');
}

export function initLibrary() {
  document.querySelectorAll('.lib-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.lib-nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.lib-section').forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('ls-' + item.dataset.section).classList.add('active');
      playSound('click');
    });
  });

  document.getElementById('qa-scan').addEventListener('click', async function() {
    this.classList.add('running'); this.textContent = '⏳ Scanning…';
    try { await API.libScan(); libLog('Scan triggered'); this.textContent = '✓ Done'; this.classList.remove('running'); this.classList.add('done'); }
    catch(e) { this.textContent = '✗ Failed'; this.classList.remove('running'); }
  });
  document.getElementById('qa-refresh-all').addEventListener('click', async function() {
    if (!confirm('Refresh ALL metadata? This may take a while.')) return;
    this.classList.add('running'); this.textContent = '⏳ Refreshing…';
    try { await API.libRefreshAll(); libLog('Refresh triggered'); this.textContent = '✓ Done'; this.classList.remove('running'); this.classList.add('done'); }
    catch(e) { this.textContent = '✗ Failed'; this.classList.remove('running'); }
  });
  document.getElementById('qa-fix-images').addEventListener('click', async function() {
    this.classList.add('running'); this.textContent = '⏳ Working…';
    try {
      const d = await API.libMissing(); let fixed = 0;
      for (const item of (d.missingPoster||[]).slice(0,20)) { await API.libRefreshImages(item.id); fixed++; libLog('Fixed: ' + item.title); }
      this.textContent = '✓ Fixed ' + fixed; this.classList.remove('running'); this.classList.add('done');
    } catch(e) { this.textContent = '✗ Failed'; this.classList.remove('running'); }
  });
  document.getElementById('qa-full-scan').addEventListener('click', async function() {
    this.classList.add('running'); this.textContent = '⏳ Scanning…';
    await runAllLibScans();
    this.textContent = '✓ Done'; this.classList.remove('running'); this.classList.add('done');
  });
  document.getElementById('qa-ai-fix-all').addEventListener('click', async function() {
    if (!confirm('AI fix all items missing overviews? Batches 20 items.')) return;
    this.classList.add('running'); this.textContent = '⏳ Fixing…';
    try {
      const d = await API.libMissing(); let fixed = 0, failed = 0;
      for (const item of (d.missingOverview||[]).slice(0,20)) {
        try {
          const r = await API.libAiFix(item.id);
          if (r.success && r.suggestion) {
            await API.libUpdateItem(item.id, { Overview: r.suggestion.overview||'', Taglines: r.suggestion.tagline?[r.suggestion.tagline]:[] });
            fixed++; libLog('✓ AI fixed: ' + item.title);
          }
        } catch(e) { failed++; libLog('✗ Failed: ' + item.title); }
        await new Promise(r => setTimeout(r, 500));
      }
      this.textContent = '✓ Fixed ' + fixed + (failed ? ', '+failed+' failed' : '');
      this.classList.remove('running'); this.classList.add('done');
      showToast('🤖', 'AI fixed ' + fixed + ' items');
    } catch(e) { this.textContent = '✗ Error'; this.classList.remove('running'); libLog('Bulk AI fix error: '+e.message); }
  });
  document.getElementById('th-save').addEventListener('click', async () => {
    const sd = document.getElementById('th-sd').value;
    const upgrade = document.getElementById('th-upgrade').value;
    const audio = document.getElementById('th-audio').value;
    try { await API.libThresholds({sd,upgrade,audio}); libLog('Thresholds saved'); await runQualityScan(); } catch(e) {}
  });
}
