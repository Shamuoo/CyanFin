// CyanFin Player - uses native browser video with direct Jellyfin stream
import { playSound } from './themes.js';

let currentItem = null;
let controlsTimer = null;
let isDragging = false;

const $ = id => document.getElementById(id);

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

export function showControls() {
  $('view-player').classList.add('controls-visible');
  clearTimeout(controlsTimer);
  const v = $('player-video');
  if (v && !v.paused) controlsTimer = setTimeout(() => $('view-player').classList.remove('controls-visible'), 3500);
}

export function initPlayer() {
  const video = $('player-video');
  const view = $('view-player');
  if (!video || !view) return;

  ['mousemove','click','touchstart'].forEach(ev => view.addEventListener(ev, showControls, { passive: true }));

  video.addEventListener('play',    () => { $('player-play-btn').textContent = '⏸'; showControls(); });
  video.addEventListener('pause',   () => { $('player-play-btn').textContent = '▶'; showControls(); });
  video.addEventListener('waiting', () => $('player-spinner').classList.add('loading'));
  video.addEventListener('canplay', () => $('player-spinner').classList.remove('loading'));
  video.addEventListener('playing', () => $('player-spinner').classList.remove('loading'));
  video.addEventListener('timeupdate', () => {
    if (!video.duration || isDragging) return;
    const pct = video.currentTime / video.duration * 100;
    $('player-progress-fill').style.width = pct + '%';
    $('player-time').textContent = fmtTime(video.currentTime) + ' / ' + fmtTime(video.duration);
  });
  video.addEventListener('ended', () => {
    if (currentItem) reportProgress(currentItem.id, video.duration * 10000000, true);
    window.dispatchEvent(new CustomEvent('player:ended', { detail: { item: currentItem } }));
  });
  video.addEventListener('error', () => {
    $('player-spinner').classList.remove('loading');
    const code = video.error ? video.error.code : '?';
    const msg = video.error ? video.error.message : 'Unknown error';
    showError(`Playback error (${code}): ${msg}`);
  });

  // Click video = toggle play
  video.addEventListener('click', e => { e.stopPropagation(); video.paused ? video.play() : video.pause(); });
  $('player-play-btn').addEventListener('click', e => { e.stopPropagation(); video.paused ? video.play() : video.pause(); playSound('click'); });

  // Seek
  const prog = $('player-progress');
  const doScrub = e => {
    const rect = prog.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    $('player-progress-fill').style.width = (pct * 100) + '%';
    if (video.duration) $('player-time').textContent = fmtTime(pct * video.duration) + ' / ' + fmtTime(video.duration);
    return pct;
  };
  prog.addEventListener('mousedown', e => { isDragging = true; doScrub(e); e.stopPropagation(); });
  prog.addEventListener('touchstart', e => { isDragging = true; doScrub(e); e.stopPropagation(); }, { passive: true });
  document.addEventListener('mousemove', e => { if (isDragging) doScrub(e); });
  document.addEventListener('mouseup', () => { if (!isDragging) return; isDragging = false; if (video.duration) video.currentTime = video.duration * parseFloat($('player-progress-fill').style.width) / 100; });
  document.addEventListener('touchend', () => { if (!isDragging) return; isDragging = false; if (video.duration) video.currentTime = video.duration * parseFloat($('player-progress-fill').style.width) / 100; });

  // Mute
  $('player-mute-btn').addEventListener('click', e => { e.stopPropagation(); video.muted = !video.muted; $('player-mute-btn').textContent = video.muted ? '🔇' : '🔊'; });

  // Volume
  $('player-vol').addEventListener('click', e => {
    e.stopPropagation();
    const pct = Math.max(0, Math.min(1, (e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth));
    video.volume = pct; $('player-vol-fill').style.width = (pct*100)+'%';
  });

  // Fullscreen
  $('player-fs-btn').addEventListener('click', e => { e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : view.requestFullscreen().catch(()=>{}); playSound('click'); });

  // PiP
  $('player-pip-btn').addEventListener('click', async e => { e.stopPropagation(); try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await video.requestPictureInPicture(); } catch(e) {} });

  // Back
  ['player-back-btn','player-back'].forEach(id => {
    const el = $(id); if (el) el.addEventListener('click', e => { e.stopPropagation(); exitPlayer(); });
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (!$('view-player').classList.contains('active')) return;
    switch(e.key) {
      case ' ': case 'k': e.preventDefault(); video.paused ? video.play() : video.pause(); showControls(); break;
      case 'ArrowLeft':  e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); showControls(); break;
      case 'ArrowRight': e.preventDefault(); video.currentTime = Math.min(video.duration||0, video.currentTime + 10); showControls(); break;
      case 'ArrowUp':    e.preventDefault(); video.volume = Math.min(1, video.volume+0.1); $('player-vol-fill').style.width=(video.volume*100)+'%'; break;
      case 'ArrowDown':  e.preventDefault(); video.volume = Math.max(0, video.volume-0.1); $('player-vol-fill').style.width=(video.volume*100)+'%'; break;
      case 'f': case 'F': document.fullscreenElement ? document.exitFullscreen() : view.requestFullscreen().catch(()=>{}); break;
      case 'm': case 'M': video.muted=!video.muted; $('player-mute-btn').textContent=video.muted?'🔇':'🔊'; break;
      case 'Escape': exitPlayer(); break;
    }
  });

  // Progress reporting
  setInterval(() => {
    if (currentItem && video && !video.paused && video.currentTime > 0)
      reportProgress(currentItem.id, video.currentTime * 10000000, false);
  }, 10000);
}

function exitPlayer() {
  stopPlayer();
  window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'home' } }));
  playSound('click');
}

async function reportProgress(itemId, ticks, stopped) {
  try {
    await fetch(`/api/items/${itemId}/${stopped ? 'playbackstopped' : 'playbackprogress'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ItemId: itemId, PositionTicks: Math.round(ticks) }),
    });
  } catch(e) {}
}

function showError(msg) {
  let el = $('player-error');
  if (!el) {
    el = document.createElement('div'); el.id = 'player-error';
    el.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#e74c3c;font-size:13px;text-align:center;padding:24px 32px;background:rgba(0,0,0,0.9);border-radius:8px;z-index:20;max-width:80vw;line-height:1.7;border:1px solid rgba(231,76,60,0.3)';
    $('view-player').appendChild(el);
  }
  el.innerHTML = `⚠️ ${msg}<br><br><button onclick="this.parentElement.remove()" style="font-size:11px;padding:5px 14px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);cursor:pointer">Dismiss</button>`;
}

export function playItem(item) {
  currentItem = item;
  const video = $('player-video');
  if (!video) return;

  const titleEl = $('player-title');
  if (titleEl) titleEl.textContent = item.title || '';

  video.pause();
  video.removeAttribute('src');
  video.load();
  const errEl = $('player-error'); if (errEl) errEl.remove();
  $('player-spinner').classList.add('loading');

  const startTime = (item.userData && item.userData.PlaybackPositionTicks > 60 * 10000000)
    ? item.userData.PlaybackPositionTicks / 10000000 : 0;

  // Get stream URL from server - returns both HLS and direct
  fetch(`/api/stream-url?id=${item.id}`)
    .then(r => r.json())
    .then(({ url, directUrl }) => {
      // Try direct stream first - always works, no transcoding needed
      // Browser plays whatever container/codec it supports natively
      video.src = directUrl;
      video.crossOrigin = 'anonymous';
      if (startTime > 0) {
        video.addEventListener('loadedmetadata', () => { video.currentTime = startTime; }, { once: true });
      }
      video.play()
        .then(() => { $('player-spinner').classList.remove('loading'); })
        .catch(err => {
          // Autoplay blocked - show message
          $('player-spinner').classList.remove('loading');
          showError('Tap anywhere to start playback');
          video.addEventListener('click', () => { video.play(); const e = $('player-error'); if(e) e.remove(); }, { once: true });
        });
    })
    .catch(err => {
      $('player-spinner').classList.remove('loading');
      showError(`Could not load stream: ${err.message}`);
    });

  playSound('play');
  showControls();
}

export function stopPlayer() {
  const video = $('player-video');
  if (!video) return;
  if (currentItem && !video.paused) reportProgress(currentItem.id, video.currentTime * 10000000, true);
  video.pause();
  video.removeAttribute('src');
  video.load();
  $('player-spinner').classList.remove('loading');
  $('view-player').classList.remove('controls-visible');
  currentItem = null;
  const errEl = $('player-error'); if (errEl) errEl.remove();
}

export function getCurrentItem() { return currentItem; }
