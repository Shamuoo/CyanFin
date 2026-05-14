// CyanFin Player v3 - uses Jellyfin PlaybackInfo for proper stream negotiation
import { playSound } from './themes.js';
import API from './api.js';

let currentItem = null;
let playSessionId = null;
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
    reportProgress(true);
    window.dispatchEvent(new CustomEvent('player:ended', { detail: { item: currentItem } }));
  });
  video.addEventListener('error', () => {
    $('player-spinner').classList.remove('loading');
    const err = video.error;
    const msgs = { 1:'Aborted',2:'Network error',3:'Decode error',4:'Format not supported' };
    showError(`${msgs[err && err.code] || 'Unknown error'} — try opening in Jellyfin directly`);
    // Show open-in-jellyfin button
    showJellyfinFallback();
  });

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

  $('player-mute-btn').addEventListener('click', e => { e.stopPropagation(); video.muted = !video.muted; $('player-mute-btn').textContent = video.muted ? '🔇' : '🔊'; });
  $('player-vol').addEventListener('click', e => {
    e.stopPropagation();
    const pct = Math.max(0, Math.min(1, (e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth));
    video.volume = pct; $('player-vol-fill').style.width = (pct*100)+'%';
  });
  $('player-fs-btn').addEventListener('click', e => { e.stopPropagation(); document.fullscreenElement ? document.exitFullscreen() : view.requestFullscreen().catch(()=>{}); });
  $('player-pip-btn').addEventListener('click', async e => { e.stopPropagation(); try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await video.requestPictureInPicture(); } catch(e) {} });

  ['player-back-btn','player-back'].forEach(id => {
    const el = $(id); if (el) el.addEventListener('click', e => { e.stopPropagation(); exitPlayer(); });
  });

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

  setInterval(() => { if (currentItem && video && !video.paused && video.currentTime > 0) reportProgress(false); }, 10000);
}

function exitPlayer() {
  stopPlayer();
  window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'home' } }));
  playSound('click');
}

async function reportProgress(stopped) {
  if (!currentItem) return;
  const video = $('player-video');
  const ticks = video ? Math.round(video.currentTime * 10000000) : 0;
  try {
    await fetch('/api/items/' + currentItem.id + '/' + (stopped ? 'playbackstopped' : 'playbackprogress'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ItemId: currentItem.id, PositionTicks: ticks, PlaySessionId: playSessionId }),
    });
  } catch(e) {}
}

function showError(msg) {
  let el = $('player-error');
  if (!el) { el = document.createElement('div'); el.id = 'player-error'; el.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#e74c3c;font-size:13px;text-align:center;padding:24px 32px;background:rgba(0,0,0,0.92);border-radius:8px;z-index:20;max-width:80vw;line-height:1.8;border:1px solid rgba(231,76,60,0.3)'; $('view-player').appendChild(el); }
  el.innerHTML = `⚠️ ${msg}<br><br><button onclick="this.parentElement.remove()" style="font-size:10px;padding:6px 14px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);cursor:pointer;margin-right:8px">Dismiss</button>`;
}

function showJellyfinFallback() {
  if (!currentItem) return;
  // Add "Open in Jellyfin" button to error
  const el = $('player-error');
  if (el) {
    const jellyfinUrl = (window._jellyfinUrl || '') + '/web/#/details?id=' + currentItem.id;
    el.innerHTML += `<a href="${jellyfinUrl}" target="_blank" style="display:inline-block;font-size:10px;padding:6px 14px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);cursor:pointer;text-decoration:none">Open in Jellyfin ↗</a>`;
  }
}

// Show which play method is being used
function showPlayMethod(method, container) {
  let badge = $('player-method-badge');
  if (!badge) { badge = document.createElement('div'); badge.id = 'player-method-badge'; badge.style.cssText = 'position:absolute;top:16px;right:60px;font-size:9px;letter-spacing:0.15em;text-transform:uppercase;padding:3px 8px;border-radius:3px;opacity:0.6;pointer-events:none;z-index:5'; $('view-player').appendChild(badge); }
  const colors = { DirectPlay:'rgba(46,204,113,0.8)', DirectStream:'rgba(93,173,226,0.8)', Transcode:'rgba(243,156,18,0.8)' };
  badge.style.background = colors[method] || 'rgba(255,255,255,0.2)';
  badge.style.color = '#000';
  badge.textContent = method + (container ? ' · ' + container : '');
  setTimeout(() => { if (badge) badge.style.opacity = '0'; }, 4000);
}

export function playItem(item) {
  currentItem = item;
  playSessionId = null;
  const video = $('player-video');
  if (!video) return;

  const titleEl = $('player-title');
  if (titleEl) titleEl.textContent = item.title || '';

  video.pause();
  video.removeAttribute('src');
  video.load();
  const errEl = $('player-error'); if (errEl) errEl.remove();
  const badge = $('player-method-badge'); if (badge) badge.remove();
  $('player-spinner').classList.add('loading');

  const startTime = (item.userData && item.userData.PlaybackPositionTicks > 60 * 10000000)
    ? item.userData.PlaybackPositionTicks / 10000000 : 0;

  // Use PlaybackInfo to get proper negotiated stream URL
  API.playbackInfo(item.id)
    .then(info => {
      if (info.error && !info.streamUrl) throw new Error(info.error);

      playSessionId = info.playSessionId;
      const streamUrl = info.streamUrl;
      const method = info.playMethod || 'DirectPlay';

      console.log('[Player] Method:', method, '| URL:', streamUrl.substring(0, 80) + '...');
      showPlayMethod(method, info.container);

      video.src = streamUrl;
      if (startTime > 0) {
        video.addEventListener('loadedmetadata', () => { video.currentTime = startTime; }, { once: true });
      }
      video.play()
        .then(() => $('player-spinner').classList.remove('loading'))
        .catch(err => {
          $('player-spinner').classList.remove('loading');
          if (err.name === 'NotAllowedError') {
            showError('Tap to start playback');
            video.addEventListener('click', () => { video.play(); const e = $('player-error'); if(e) e.remove(); }, { once: true });
          } else {
            showError('Playback failed: ' + err.message);
            showJellyfinFallback();
          }
        });
    })
    .catch(err => {
      $('player-spinner').classList.remove('loading');
      showError('Could not start playback: ' + err.message);
      showJellyfinFallback();
    });

  playSound('play');
  showControls();
}

export function stopPlayer() {
  const video = $('player-video');
  if (!video) return;
  if (currentItem && !video.paused) reportProgress(true);
  video.pause();
  video.removeAttribute('src');
  video.load();
  $('player-spinner').classList.remove('loading');
  $('view-player').classList.remove('controls-visible');
  currentItem = null;
  playSessionId = null;
  const errEl = $('player-error'); if (errEl) errEl.remove();
  const badge = $('player-method-badge'); if (badge) badge.remove();
}

export function getCurrentItem() { return currentItem; }
