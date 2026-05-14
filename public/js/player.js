// CyanFin Video Player v2
import { playSound } from './themes.js';

let currentItem = null;
let controlsTimer = null;
let isDragging = false;
let hlsInstance = null;

const $ = id => document.getElementById(id);

function fmtTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}

export function showControls() {
  const view = $('view-player');
  if (!view) return;
  view.classList.add('controls-visible');
  clearTimeout(controlsTimer);
  const video = $('player-video');
  if (video && !video.paused) {
    controlsTimer = setTimeout(() => view.classList.remove('controls-visible'), 3500);
  }
}

function hideControls() {
  const video = $('player-video');
  if (video && !video.paused) $('view-player').classList.remove('controls-visible');
}

export function initPlayer() {
  const video = $('player-video');
  const view = $('view-player');
  if (!video || !view) return;

  // Show controls on any interaction
  ['mousemove','click','touchstart'].forEach(ev =>
    view.addEventListener(ev, showControls, { passive: true })
  );

  // Video state
  video.addEventListener('play', () => { $('player-play-btn').textContent = '⏸'; showControls(); });
  video.addEventListener('pause', () => { $('player-play-btn').textContent = '▶'; showControls(); });
  video.addEventListener('waiting', () => $('player-spinner').classList.add('loading'));
  video.addEventListener('canplay', () => $('player-spinner').classList.remove('loading'));
  video.addEventListener('playing', () => $('player-spinner').classList.remove('loading'));
  video.addEventListener('timeupdate', () => {
    if (!video.duration || isDragging) return;
    const pct = (video.currentTime / video.duration) * 100;
    $('player-progress-fill').style.width = `${pct}%`;
    $('player-time').textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
  });
  video.addEventListener('ended', () => {
    if (currentItem) reportProgress(currentItem.id, video.duration * 10000000, true);
    window.dispatchEvent(new CustomEvent('player:ended', { detail: { item: currentItem } }));
  });
  video.addEventListener('error', () => {
    $('player-spinner').classList.remove('loading');
    showError(`Video error: ${video.error ? video.error.message : 'unknown'}`);
  });

  // Click video = play/pause
  video.addEventListener('click', (e) => {
    e.stopPropagation();
    video.paused ? video.play() : video.pause();
  });

  // Play button
  $('player-play-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    video.paused ? video.play() : video.pause();
    playSound('click');
  });

  // Seek bar
  const prog = $('player-progress');
  const scrub = (e) => {
    const rect = prog.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    $('player-progress-fill').style.width = `${pct * 100}%`;
    if (video.duration) $('player-time').textContent = `${fmtTime(pct * video.duration)} / ${fmtTime(video.duration)}`;
    return pct;
  };
  prog.addEventListener('mousedown', (e) => { isDragging = true; scrub(e); e.stopPropagation(); });
  prog.addEventListener('touchstart', (e) => { isDragging = true; scrub(e); e.stopPropagation(); }, { passive: true });
  document.addEventListener('mousemove', (e) => { if (isDragging) scrub(e); });
  document.addEventListener('touchmove', (e) => { if (isDragging) scrub(e); }, { passive: true });
  const endScrub = () => {
    if (!isDragging) return;
    isDragging = false;
    if (video.duration) video.currentTime = video.duration * parseFloat($('player-progress-fill').style.width) / 100;
  };
  document.addEventListener('mouseup', endScrub);
  document.addEventListener('touchend', endScrub);

  // Mute
  $('player-mute-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    video.muted = !video.muted;
    $('player-mute-btn').textContent = video.muted ? '🔇' : '🔊';
    playSound('click');
  });

  // Volume bar
  $('player-vol').addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.volume = pct;
    $('player-vol-fill').style.width = `${pct * 100}%`;
  });

  // Fullscreen
  $('player-fs-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.fullscreenElement ? document.exitFullscreen() : view.requestFullscreen().catch(() => {});
    playSound('click');
  });

  // PiP
  $('player-pip-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      document.pictureInPictureElement ? await document.exitPictureInPicture() : await video.requestPictureInPicture();
    } catch(err) {}
    playSound('click');
  });

  // Back buttons (both the nav one and the persistent one)
  ['player-back-btn', 'player-back'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('click', (e) => { e.stopPropagation(); exitPlayer(); });
  });

  // Keyboard — only when player active
  document.addEventListener('keydown', (e) => {
    if (!$('view-player').classList.contains('active')) return;
    switch(e.key) {
      case ' ': case 'k': e.preventDefault(); video.paused ? video.play() : video.pause(); showControls(); break;
      case 'ArrowLeft': e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); showControls(); break;
      case 'ArrowRight': e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); showControls(); break;
      case 'ArrowUp': e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); $('player-vol-fill').style.width = `${video.volume*100}%`; showControls(); break;
      case 'ArrowDown': e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); $('player-vol-fill').style.width = `${video.volume*100}%`; showControls(); break;
      case 'f': case 'F': document.fullscreenElement ? document.exitFullscreen() : view.requestFullscreen().catch(()=>{}); break;
      case 'm': case 'M': video.muted = !video.muted; $('player-mute-btn').textContent = video.muted ? '🔇' : '🔊'; break;
      case 'Escape': exitPlayer(); break;
    }
  });

  // Progress report every 10s
  setInterval(() => {
    const video = $('player-video');
    if (video && !video.paused && currentItem && video.currentTime > 0) {
      reportProgress(currentItem.id, video.currentTime * 10000000, false);
    }
  }, 10000);
}

function exitPlayer() {
  stopPlayer();
  window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'home' } }));
  playSound('click');
}

async function reportProgress(itemId, positionTicks, stopped) {
  try {
    await fetch(`/api/items/${itemId}/${stopped ? 'playbackstopped' : 'playbackprogress'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ItemId: itemId, PositionTicks: Math.round(positionTicks) }),
    });
  } catch(e) {}
}

function showError(msg) {
  let el = $('player-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'player-error';
    el.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#e74c3c;font-size:13px;text-align:center;padding:20px 28px;background:rgba(0,0,0,0.85);border-radius:8px;z-index:10;max-width:80vw;line-height:1.6';
    $('view-player').appendChild(el);
  }
  el.innerHTML = `⚠️ ${msg}<br><br><button onclick="document.getElementById('player-error').remove()" style="font-size:11px;padding:5px 12px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);cursor:pointer">Dismiss</button>`;
  el.style.display = 'block';
}

export function playItem(item) {
  currentItem = item;
  const video = $('player-video');
  const titleEl = $('player-title');
  if (!video) return;
  if (titleEl) titleEl.textContent = item.title || '';

  // Clear previous
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  video.pause();
  video.removeAttribute('src');
  video.load();
  const errEl = $('player-error');
  if (errEl) errEl.remove();
  $('player-spinner').classList.add('loading');

  const startTime = (item.userData && item.userData.PlaybackPositionTicks > 60 * 10000000)
    ? item.userData.PlaybackPositionTicks / 10000000 : 0;

  // Get actual stream URL from server (avoids redirect issues with HLS.js)
  fetch(`/api/stream-url?id=${item.id}`)
    .then(r => r.json())
    .then(({ url, directUrl }) => {
      if (window.Hls && window.Hls.isSupported()) {
        loadHLS(url, startTime, directUrl);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = url;
        if (startTime > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = startTime; }, { once: true });
        video.play().catch(err => { showError('Playback blocked — tap to play'); $('player-spinner').classList.remove('loading'); });
      } else {
        // Fallback direct
        video.src = directUrl;
        if (startTime > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = startTime; }, { once: true });
        video.play().catch(err => showError('Could not start playback'));
        $('player-spinner').classList.remove('loading');
      }
    })
    .catch(err => {
      showError(`Failed to get stream URL: ${err.message}`);
      $('player-spinner').classList.remove('loading');
    });

  playSound('play');
  showControls();
}

function loadHLS(url, startTime, fallbackUrl) {
  const video = $('player-video');
  hlsInstance = new window.Hls({
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    startFragPrefetch: true,
    xhrSetup: (xhr) => { xhr.withCredentials = false; },
  });
  hlsInstance.loadSource(url);
  hlsInstance.attachMedia(video);
  hlsInstance.once(window.Hls.Events.MANIFEST_PARSED, () => {
    if (startTime > 0) video.currentTime = startTime;
    video.play().catch(err => {
      showError('Playback blocked by browser — tap to play');
      $('player-spinner').classList.remove('loading');
    });
  });
  hlsInstance.on(window.Hls.Events.ERROR, (event, data) => {
    console.warn('HLS error:', data.type, data.details, data.fatal);
    if (data.fatal) {
      hlsInstance.destroy(); hlsInstance = null;
      if (fallbackUrl) {
        console.log('Falling back to direct stream');
        video.src = fallbackUrl;
        if (startTime > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = startTime; }, { once: true });
        video.play().catch(() => showError('Playback failed — check Jellyfin transcoding settings'));
        $('player-spinner').classList.remove('loading');
      } else {
        showError(`Stream failed: ${data.details}`);
        $('player-spinner').classList.remove('loading');
      }
    }
  });
}

export function stopPlayer() {
  const video = $('player-video');
  if (!video) return;
  if (currentItem && !video.paused) {
    reportProgress(currentItem.id, video.currentTime * 10000000, true);
  }
  video.pause();
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  video.removeAttribute('src');
  video.load();
  $('player-spinner').classList.remove('loading');
  $('view-player').classList.remove('controls-visible');
  currentItem = null;
  const errEl = $('player-error');
  if (errEl) errEl.remove();
}

export function getCurrentItem() { return currentItem; }
