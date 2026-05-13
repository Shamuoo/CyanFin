// Theme and settings management
const STORAGE_KEY = 'cyanfin-settings';

const DEFAULTS = {
  theme: 'cinema',
  city: 'Brisbane',
  units: 'C',
  ssDelay: 300,
  hr12: false,
  weather: true,
  trailer: true,
  ss: true,
  sounds: true,
};

let settings = { ...DEFAULTS };

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    settings = { ...DEFAULTS, ...saved };
  } catch(e) {}
  applyTheme(settings.theme);
  return settings;
}

export function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch(e) {}
}

export function get(key) { return settings[key]; }
export function set(key, value) { settings[key] = value; saveSettings(); }
export function getAll() { return { ...settings }; }

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  settings.theme = theme;
  saveSettings();
  // Update swatch active state
  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === theme);
  });
}

export function initSettingsPanel() {
  const s = settings;

  // Theme swatches
  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.addEventListener('click', () => applyTheme(el.dataset.theme));
  });

  // Inputs
  const cityInput = document.getElementById('s-city');
  const unitsSelect = document.getElementById('s-units');
  const ssDelayInput = document.getElementById('s-ssdelay');

  if (cityInput) { cityInput.value = s.city || ''; cityInput.addEventListener('change', e => set('city', e.target.value)); }
  if (unitsSelect) { unitsSelect.value = s.units || 'C'; unitsSelect.addEventListener('change', e => set('units', e.target.value)); }
  if (ssDelayInput) { ssDelayInput.value = s.ssDelay || 300; ssDelayInput.addEventListener('change', e => set('ssDelay', parseInt(e.target.value) || 300)); }

  // Toggles
  const toggles = [
    ['s-12hr', 'hr12'],
    ['s-weather', 'weather'],
    ['s-trailer', 'trailer'],
    ['s-ss', 'ss'],
    ['s-sounds', 'sounds'],
  ];
  toggles.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (s[key]) el.classList.add('on');
    el.addEventListener('click', () => {
      el.classList.toggle('on');
      set(key, el.classList.contains('on'));
    });
  });

  // Username display
  const userEl = document.getElementById('s-username');
  if (userEl) {
    const user = JSON.parse(sessionStorage.getItem('cf_user') || 'null');
    if (user) userEl.textContent = user.name;
  }

  // Theme swatch active state
  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === s.theme);
  });
}

// Sound effects
const sounds = {};
function getAudioCtx() {
  if (!window._audioCtx) window._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return window._audioCtx;
}

export function playSound(type) {
  if (!get('sounds')) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'click') {
      osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
      gain.gain.setValueAtTime(0.06, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'open') {
      osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now); osc.stop(now + 0.12);
    } else if (type === 'play') {
      [440, 554, 659].forEach((freq, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        const t = now + i * 0.1;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t); o.stop(t + 0.3);
      });
    }
  } catch(e) {}
}

export function showToast(icon, text, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${text}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}
