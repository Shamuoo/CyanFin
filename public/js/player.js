// Video player
import { playSound } from './themes.js';

let currentItem = null;
let controlsTimer = null;
let isDragging = false;
let qrInstance = null;

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

function fmtTicks(ticks) { return fmtTime((ticks || 0) / 10000000); }

function showControls() {
  view.classList.add('controls-visible');
  clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => {
    if (!video.paused) view.classList.remove('controls-visible');
  }, 3000);
}

function updateProgress() {
  if (!video.duration || isDragging) return;
  const pct = (video.currentTime / video.duration) * 100;
  progressFill.style.width = `${pct}%`;
  timeEl.textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
}

export function initPlayer() {
  // Controls visibility
  view.addEventListener('mousemove', showControls);
  view.addEventListener('touchstart', showControls);

  // Play/pause
  video.addEventListener('play', () => { playBtn.textContent = '⏸'; });
  video.addEventListener('pause', () => { playBtn.textContent = '▶'; view.classList.add('controls-visible'); });
  video.addEventListener('waiting', () => spinner.classList.add('loading'));
  video.addEventListener('playing', () => spinner.classList.remove('loading'));
  video.addEventListener('timeupdate', updateProgress);

  video.addEventListener('ended', () => {
    // Report progress to Jellyfin
    if (currentItem) reportProgress(currentItem.id, video.duration * 10000000, true);
    window.dispatchEvent(new CustomEvent('player:ended', { detail: { item: currentItem } }));
  });

  playBtn.addEventListener('click', () => {
    if (video.paused) video.play();
    else video.pause();
    playSound('click');
  });

  // Progress bar scrubbing
  progressBar.addEventListener('mousedown', (e) => {
    isDragging = true;
    scrub(e);
  });
  document.addEventListener('mousemove', (e) => { if (isDragging) scrub(e); });
  document.addEventListener('mouseup', () => {
    if (isDragging) { isDragging = false; video.currentTime = video.duration * (parseFloat(progressFill.style.width) / 100); }
  });

  function scrub(e) {
    const rect = progressBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    progressFill.style.width = `${pct * 100}%`;
    if (video.duration) timeEl.textContent = `${fmtTime(pct * video.duration)} / ${fmtTime(video.duration)}`;
  }

  // Volume
  document.getElementById('player-mute-btn').addEventListener('click', () => {
    video.muted = !video.muted;
    document.getElementById('player-mute-btn').textContent = video.muted ? '🔇' : '🔊';
    playSound('click');
  });
  document.getElementById('player-vol').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.volume = pct;
    volFill.style.width = `${pct * 100}%`;
  });

  // Fullscreen
  document.getElementById('player-fs-btn').addEventListener('click', () => {
    if (!document.fullscreenElement) view.requestFullscreen();
    else document.exitFullscreen();
    playSound('click');
  });

  // Picture in Picture
  document.getElementById('player-pip-btn').addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch(e) {}
    playSound('click');
  });

  // Back button
  document.getElementById('player-back-btn').addEventListener('click', () => {
    stopPlayer();
    window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'home' } }));
    playSound('click');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const activeView = document.querySelector('.view.active');
    if (!activeView || activeView.id !== 'view-player') return;
    switch(e.key) {
      case ' ': case 'k': e.preventDefault(); if (video.paused) video.play(); else video.pause(); break;
      case 'ArrowLeft': e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); showControls(); break;
      case 'ArrowRight': e.preventDefault(); video.currentTime = Math.min(video.duration, video.currentTime + 10); showControls(); break;
      case 'ArrowUp': e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); break;
      case 'ArrowDown': e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); break;
      case 'f': case 'F': if (!document.fullscreenElement) view.requestFullscreen(); else document.exitFullscreen(); break;
      case 'Escape': stopPlayer(); window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'home' } })); break;
      case 'm': case 'M': video.muted = !video.muted; break;
    }
  });

  // Progress reporting interval
  setInterval(() => {
    if (!video.paused && currentItem && video.currentTime > 0) {
      reportProgress(currentItem.id, video.currentTime * 10000000, false);
    }
  }, 10000);
}

async function reportProgress(itemId, positionTicks, stopped) {
  try {
    if (stopped) await fetch(`/api/items/${itemId}/playbackstopped`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ItemId: itemId, PositionTicks: positionTicks }) });
  } catch(e) {}
}

export function playItem(item) {
  currentItem = item;
  const streamUrl = `/proxy/stream?id=${item.id}`;

  video.src = streamUrl;
  titleEl.textContent = item.title || '';

  // Resume from saved position
  if (item.userData && item.userData.PlaybackPositionTicks > 0) {
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = item.userData.PlaybackPositionTicks / 10000000;
    }, { once: true });
  }

  video.play().catch(e => console.warn('Autoplay:', e));
  playSound('play');
  showControls();
}

export function stopPlayer() {
  if (!video.paused) {
    if (currentItem) reportProgress(currentItem.id, video.currentTime * 10000000, true);
    video.pause();
  }
  video.src = '';
  currentItem = null;
}

export function getCurrentItem() { return currentItem; }
