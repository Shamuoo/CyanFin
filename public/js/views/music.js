import API from '../api.js';
import { playSound, showToast, get as getSetting } from '../themes.js';

let queue = [], queueIdx = 0, isPlaying = false, isShuffle = false, isRepeat = false;
let audioEl = null;

export function initMusic() {
  audioEl = document.getElementById('audio-player');
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.id = 'audio-player';
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
  }

  audioEl.addEventListener('timeupdate', updateAudioProgress);
  audioEl.addEventListener('ended', playNext);
  audioEl.addEventListener('play', () => { isPlaying = true; updateAudioUI(); });
  audioEl.addEventListener('pause', () => { isPlaying = false; updateAudioUI(); });
  audioEl.addEventListener('error', () => { showToast('⚠️', 'Audio error, skipping'); setTimeout(playNext, 1000); });

  const pb = document.getElementById('audio-play-btn');
  if (pb) pb.addEventListener('click', togglePlay);
  const prev = document.getElementById('audio-prev-btn');
  if (prev) prev.addEventListener('click', playPrev);
  const next = document.getElementById('audio-next-btn');
  if (next) next.addEventListener('click', playNext);
  const shuf = document.getElementById('audio-shuffle-btn');
  if (shuf) shuf.addEventListener('click', () => { isShuffle = !isShuffle; shuf.classList.toggle('active', isShuffle); playSound('click'); });
  const rep = document.getElementById('audio-repeat-btn');
  if (rep) rep.addEventListener('click', () => { isRepeat = !isRepeat; rep.classList.toggle('active', isRepeat); playSound('click'); });
  const prog = document.getElementById('audio-progress');
  if (prog) prog.addEventListener('click', e => {
    const pct = (e.clientX - prog.getBoundingClientRect().left) / prog.offsetWidth;
    if (audioEl.duration) audioEl.currentTime = pct * audioEl.duration;
  });
  const vol = document.getElementById('audio-vol');
  if (vol) vol.addEventListener('input', () => { audioEl.volume = vol.value / 100; });
}

export async function loadMusic() {
  const content = document.getElementById('music-content');
  if (!content) return;
  content.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const albums = await API.albums();
    content.innerHTML = '';
    if (!albums || !albums.length) { content.innerHTML = '<div class="empty-state">No music found</div>'; return; }
    const grid = document.createElement('div'); grid.className = 'card-grid';
    albums.forEach(album => {
      const card = document.createElement('div'); card.className = 'card';
      card.addEventListener('click', () => openAlbum(album));
      const wrap = document.createElement('div'); wrap.className = 'card-img-wrap'; wrap.style.pointerEvents = 'none';
      const img = document.createElement('img'); img.className = 'card-img'; img.src = album.imageUrl || '';
      img.onerror = () => { const ph = document.createElement('div'); ph.className = 'card-ph'; ph.textContent = '🎵'; img.replaceWith(ph); };
      wrap.appendChild(img); card.appendChild(wrap);
      const title = document.createElement('div'); title.className = 'card-title'; title.textContent = album.title || '';
      const meta = document.createElement('div'); meta.className = 'card-meta'; meta.textContent = [album.artist, album.year].filter(Boolean).join(' · ');
      card.appendChild(title); card.appendChild(meta);
      grid.appendChild(card);
    });
    content.appendChild(grid);
  } catch(e) { content.innerHTML = '<div class="empty-state">Failed to load music</div>'; }
}

async function openAlbum(album) {
  const content = document.getElementById('music-content'); if (!content) return;
  content.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const tracks = await API.tracks(album.id);
    content.innerHTML = '';
    // Back + album header
    const back = document.createElement('button'); back.className = 'back-btn'; back.style.margin = '0 0 16px';
    back.textContent = '← All Albums'; back.addEventListener('click', loadMusic);
    content.appendChild(back);
    const header = document.createElement('div'); header.style.cssText = 'display:flex;gap:20px;align-items:center;margin-bottom:24px;padding:0 4px';
    header.innerHTML = `<img src="${album.imageUrl || ''}" style="width:100px;height:100px;border-radius:var(--radius);object-fit:cover;flex-shrink:0" onerror="this.style.display='none'" />
      <div><div style="font-family:var(--font-display);font-size:22px;letter-spacing:0.1em;color:var(--cream)">${album.title || ''}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">${[album.artist, album.year].filter(Boolean).join(' · ')}</div>
      <button class="action-btn action-btn-primary" id="play-all-btn" style="margin-top:12px;font-size:10px">▶ Play All</button></div>`;
    content.appendChild(header);
    document.getElementById('play-all-btn').addEventListener('click', () => {
      queue = tracks; queueIdx = 0; playTrack(0); playSound('play');
    });
    const list = document.createElement('div'); list.style.cssText = 'display:flex;flex-direction:column;gap:3px';
    tracks.forEach((track, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:var(--radius);cursor:pointer;transition:background 0.15s';
      row.addEventListener('mouseover', () => row.style.background = 'var(--subtle)');
      row.addEventListener('mouseout', () => row.style.background = '');
      row.addEventListener('click', () => { queue = tracks; queueIdx = idx; playTrack(idx); });
      const num = document.createElement('div'); num.style.cssText = 'width:24px;text-align:right;font-size:10px;color:var(--muted);flex-shrink:0'; num.textContent = track.trackNumber || idx + 1;
      const title = document.createElement('div'); title.style.cssText = 'flex:1;font-size:12px;color:var(--cream);opacity:0.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; title.textContent = track.title || '';
      const dur = document.createElement('div'); dur.style.cssText = 'font-size:10px;color:var(--muted);flex-shrink:0'; dur.textContent = track.duration ? fmtMs(track.duration) : '';
      row.appendChild(num); row.appendChild(title); row.appendChild(dur);
      list.appendChild(row);
    });
    content.appendChild(list);
  } catch(e) { content.innerHTML = '<div class="empty-state">Failed to load album</div>'; }
}

function fmtMs(ticks) {
  const s = Math.floor(ticks / 10000000);
  return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
}

function playTrack(idx) {
  if (!queue.length) return;
  if (isShuffle && idx === queueIdx) idx = Math.floor(Math.random() * queue.length);
  queueIdx = Math.max(0, Math.min(idx, queue.length - 1));
  const track = queue[queueIdx];
  if (!track) return;
  audioEl.src = track.streamUrl || '';
  audioEl.play().catch(() => {});
  updateNowPlaying(track);
  showAudioBar();
}

function playNext() {
  if (isRepeat) { audioEl.currentTime = 0; audioEl.play(); return; }
  if (isShuffle) { queueIdx = Math.floor(Math.random() * queue.length); }
  else { queueIdx = (queueIdx + 1) % queue.length; }
  playTrack(queueIdx);
}

function playPrev() {
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
  queueIdx = Math.max(0, queueIdx - 1);
  playTrack(queueIdx);
}

function togglePlay() {
  if (!audioEl.src) return;
  audioEl.paused ? audioEl.play() : audioEl.pause();
}

function updateAudioUI() {
  const pb = document.getElementById('audio-play-btn');
  if (pb) pb.textContent = isPlaying ? '⏸' : '▶';
}

function updateAudioProgress() {
  if (!audioEl.duration) return;
  const pct = audioEl.currentTime / audioEl.duration * 100;
  const fill = document.getElementById('audio-progress-fill'); if (fill) fill.style.width = pct + '%';
  const cur = document.getElementById('audio-current'); if (cur) cur.textContent = fmtMs(audioEl.currentTime * 10000000);
  const tot = document.getElementById('audio-total'); if (tot) tot.textContent = fmtMs(audioEl.duration * 10000000);
}

function updateNowPlaying(track) {
  const t = document.getElementById('audio-track-title'); if (t) t.textContent = track.title || '';
  const a = document.getElementById('audio-track-artist'); if (a) a.textContent = [track.artist, track.album].filter(Boolean).join(' · ');
  // Update document title
  document.title = (track.title || '') + ' — CyanFin';
}

function showAudioBar() {
  const bar = document.getElementById('audio-bar');
  if (bar) { bar.style.display = 'flex'; requestAnimationFrame(() => bar.classList.add('visible')); }
}

export function hideAudioBar() {
  const bar = document.getElementById('audio-bar');
  if (bar) bar.classList.remove('visible');
  audioEl.pause();
  queue = []; queueIdx = 0;
}
