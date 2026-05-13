// CyanFin Video Player
import { playSound } from './themes.js';

let currentItem = null;
let controlsTimer = null;
let isDragging = false;
let hlsInstance = null;

const video = document.getElementById('player-video');
const playBtn = document.getElementById('player-play-btn');
const progressFill = document.getElementById('player-progress-fill');
const progressBar = document.getElementById('player-progress');
const timeEl = document.getElementById('player-time');
const titleEl = document.getElementById('player-title');
const volFill = document.getElementById('player-vol-fill');
const spinner = document.getElementById('player-spinner');
const view = document.getElementById('view-player');

function fmtTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

export function showControls() {
  view.classList.add('controls-visible');
  clearTimeout(controlsTimer);
  if (!video.paused) {
    controlsTimer = setTimeout(() => view.classList.remove('controls-visible'), 3500);
  }
}

function updateProgress() {
  if (!video.duration || isDragging) return;
  const pct = (video.currentTime / video.duration) * 100;
  progressFill.style.width = `${pct}%`;
  timeEl.textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
}

export function initPlayer() {
  // Always show controls on any interaction
  view.addEventListener('mousemove', showControls);
  view.addEventListener('touchstart', showControls, { passive: true });
  view.addEventListener('click', showControls);

  // Video events
  video.addEventListener('play', () => { playBtn.textContent = '⏸'; showControls(); });
  video.addEventListener('pause', () => { playBtn.textContent = '▶'; view.classList.add('controls-visible'); clearTimeout(controlsTimer); });
  video.addEventListener('waiting', () => spinner.classList.add('loading'));
  video.addEventListener('canplay', () => spinner.classList.remove('loading'));
  video.addEventListener('playing', () => spinner.classList.remove('loading'));
  video.addEventListener('timeupdate', updateProgress);
  video.addEventListener('ended', () => {
    if (currentItem) reportProgress(currentItem.id, video.duration * 10000000, true);
    window.dispatchEvent(new CustomEvent('player:ended', { detail: { item: currentItem } }));
  });

  // Play/pause toggle
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (video.paused) video.play();
    else video.pause();
    playSound('click');
  });

  // Click center of video to play/pause
  video.addEventListener('click', () => {
    if (video.paused) video.play();
    else video.pause();
  });

  // Progress bar scrubbing
  progressBar.addEventListener('mousedown', (e) => { isDragging = true; scrub(e); e.stopPropagation(); });
  progressBar.addEventListener('touchstart', (e) => { isDragging = true; scrub(e.touches[0]); e.stopPropagation(); }, { passive: true });
  document.addEventListener('mousemove', (e) => { if (isDragging) scrub(e); });
  document.addEventListener('touchmove', (e) => { if (isDragging) scrub(e.touches[0]); }, { passive: true });
  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    if (video.duration) video.currentTime = video.duration * (parseFloat(progressFill.style.width) / 100);
  });
  document.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    if (video.duration) video.currentTime = video.duration * (parseFloat(progressFill.style.width) / 100);
  });

  function scrub(e) {
    const rect = progressBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    progressFill.style.width = `${pct * 100}%`;
    if (video.duration) timeEl.textContent = `${fmtTime(pct * video.duration)} / ${fmtTime(video.duration)}`;
  }

  // Volume
  const muteBtn = document.getElementById('player-mute-btn');
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? '🔇' : '🔊';
    playSound('click');
  });
  document.getElementById('player-vol').addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.volume = pct;
    volFill.style.width = `${pct * 100}%`;
  });

  // Fullscreen
  document.getElementById('player-fs-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) view.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
    playSound('click');
  });

  // PiP
  document.getElementById('player-pip-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch(e) {}
    playSound('click');
  });

  // Back button — always visible, exits player
  document.getElementById('player-back-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    exitPlayer();
  });

  // Keyboard shortcuts — only when player is active
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('view-player').style.display === 'none') return;
    if (!document.getElementById('view-player').classList.contains('active')) return;
    switch(e.key) {
      case ' ': case 'k': e.preventDefault(); if (video.paused) video.play(); else video.pause(); showControls(); break;
      case 'ArrowLeft': e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); showControls(); break;
      case 'ArrowRight': e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); showControls(); break;
      case 'ArrowUp': e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); volFill.style.width = `${video.volume * 100}%`; showControls(); break;
      case 'ArrowDown': e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); volFill.style.width = `${video.volume * 100}%`; showControls(); break;
      case 'f': case 'F': if (!document.fullscreenElement) view.requestFullscreen().catch(()=>{}); else document.exitFullscreen(); break;
      case 'm': case 'M': video.muted = !video.muted; document.getElementById('player-mute-btn').textContent = video.muted ? '🔇' : '🔊'; break;
      case 'Escape': exitPlayer(); break;
    }
  });

  // Progress reporting every 10s
  setInterval(() => {
    if (!video.paused && currentItem && video.currentTime > 0) {
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
    const endpoint = stopped ? 'playbackstopped' : 'playbackprogress';
    await fetch(`/api/items/${itemId}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ItemId: itemId, PositionTicks: Math.round(positionTicks) }),
    });
  } catch(e) {}
}

export function playItem(item) {
  currentItem = item;
  if (titleEl) titleEl.textContent = item.title || '';

  // Destroy previous HLS
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  video.src = '';
  spinner.classList.add('loading');

  const startTime = (item.userData && item.userData.PlaybackPositionTicks > 60 * 10000000)
    ? item.userData.PlaybackPositionTicks / 10000000 : 0;

  // Build direct Jellyfin stream URL using token stored in sessionStorage
  const user = JSON.parse(sessionStorage.getItem('cf_user') || 'null');

  // Use /proxy/stream which redirects to Jellyfin HLS URL
  // HLS.js needs to follow the redirect itself with credentials
  // So we ask server for the actual URL first
  fetch(`/api/stream-url?id=${item.id}`)
    .then(r => r.json())
    .then(({ url }) => startPlayback(url, startTime))
    .catch(() => {
      // Fallback: try direct stream
      startPlayback(`/proxy/stream?id=${item.id}`, startTime);
    });

  playSound('play');
  showControls();
}

function startPlayback(streamUrl, startTime) {
  if (window.Hls && window.Hls.isSupported()) {
    hlsInstance = new window.Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      startFragPrefetch: true,
      debug: false,
    });
    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(video);
    hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
      if (startTime > 0) video.currentTime = startTime;
      video.play().catch(e => console.warn('Autoplay blocked:', e));
      spinner.classList.remove('loading');
    });
    hlsInstance.on(window.Hls.Events.ERROR, (event, data) => {
      console.warn('HLS error:', data.type, data.details);
      if (data.fatal) {
        spinner.classList.remove('loading');
        if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
          hlsInstance.startLoad();
        } else {
          showPlayerError('Stream error — try a different format');
        }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native HLS (Safari/iOS)
    video.src = streamUrl;
    if (startTime > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = startTime; }, { once: true });
    video.play().catch(e => console.warn('Autoplay:', e));
    spinner.classList.remove('loading');
  } else {
    showPlayerError('HLS not supported in this browser');
    spinner.classList.remove('loading');
  }
}

function showPlayerError(msg) {
  const el = document.getElementById('player-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  else {
    const div = document.createElement('div');
    div.id = 'player-error';
    div.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#e74c3c;font-size:14px;text-align:center;padding:20px;background:rgba(0,0,0,0.8);border-radius:8px;z-index:10';
    div.textContent = msg;
    document.getElementById('view-player').appendChild(div);
  }
}

export function stopPlayer() {
  if (currentItem && !video.paused) {
    reportProgress(currentItem.id, video.currentTime * 10000000, true);
  }
  video.pause();
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  video.src = '';
  spinner.classList.remove('loading');
  view.classList.remove('controls-visible');
  currentItem = null;
  const errEl = document.getElementById('player-error');
  if (errEl) errEl.remove();
}

export function getCurrentItem() { return currentItem; }
