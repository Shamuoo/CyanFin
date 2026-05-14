import API from '../api.js';

function fmtUptime(s) {
  if (!s) return '—';
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  return [d && d+'d', h && h+'h', m+'m'].filter(Boolean).join(' ');
}

function bar(pct, color) {
  return `<div class="h-bar"><div class="h-bar-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

export async function loadHealth() {
  const grid = document.getElementById('health-grid');
  const actEl = document.getElementById('health-activity');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-spinner" style="grid-column:1/-1"></div>';

  try {
    const [d, sys] = await Promise.all([API.health(), API.systemStats().catch(() => ({}))]);
    grid.innerHTML = '';

    const lc = d.latency < 50 ? '#2ecc71' : d.latency < 200 ? '#f39c12' : '#e74c3c';

    // CyanFin card
    addCard(grid, 'CyanFin', [
      ['Version', 'v' + (d.cyanFinVersion || '0.10.0')],
      d.github ? ['Latest', d.github.latestRelease, d.github.isLatest ? 'good' : 'warn'] : null,
    ].filter(Boolean));

    // Connection
    const connCard = mkCard('Connection');
    connCard.innerHTML += `<div class="h-stat"><span class="h-label">Latency</span><span class="h-value" style="color:${lc}">${d.latency}ms</span></div>
      ${bar(Math.min(100,(d.latency/500)*100), lc)}
      <div class="h-stat" style="margin-top:6px"><span class="h-label">Server</span><span class="h-value">${d.serverName||'—'}</span></div>
      <div class="h-stat"><span class="h-label">Version</span><span class="h-value">${d.version||'—'}</span></div>
      <div class="h-stat"><span class="h-label">Local</span><span class="h-value">${d.localAddress||'—'}</span></div>`;
    grid.appendChild(connCard);

    // Sessions
    addCard(grid, 'Sessions', [
      ['Active', d.activeSessions, d.activeSessions > 0 ? 'good' : ''],
      ['Connected', d.totalSessions, ''],
      ['Transcoding', d.transcoding, d.transcoding > 0 ? 'warn' : 'good'],
    ]);

    // Now playing
    if (d.nowPlaying && d.nowPlaying.length) {
      const npCard = mkCard('Now Playing');
      d.nowPlaying.forEach(s => {
        npCard.innerHTML += `<div style="margin-bottom:8px;padding:8px;background:rgba(255,255,255,0.03);border-radius:4px;border:1px solid var(--border2)">
          <div style="font-size:9px;color:var(--accent);opacity:0.6;margin-bottom:2px">${s.user} · ${s.device}</div>
          <div style="font-size:11px;color:var(--muted)">${s.title}</div>
          <div style="font-size:8px;color:var(--muted);opacity:0.5;margin-top:2px">${s.isPaused?'⏸ Paused':'▶ Playing'} · ${s.progress}%</div>
          <div class="h-bar" style="margin-top:4px"><div class="h-bar-fill" style="width:${s.progress}%;background:var(--accent)"></div></div>
        </div>`;
      });
      grid.appendChild(npCard);
    }

    // CPU
    if (sys.cpuPercent !== undefined) {
      const cc = sys.cpuPercent > 80 ? '#e74c3c' : sys.cpuPercent > 50 ? '#f39c12' : '#2ecc71';
      const cpuCard = mkCard(`CPU${sys.cpuModel ? ` <span style="font-weight:400;font-size:8px;opacity:0.4;text-transform:none">${sys.cpuCores}c</span>` : ''}`);
      cpuCard.innerHTML += `<div class="h-stat"><span class="h-label">Usage</span><span class="h-value" style="color:${cc}">${sys.cpuPercent}%</span></div>
        ${bar(sys.cpuPercent, cc)}
        <div class="h-stat" style="margin-top:6px"><span class="h-label">Load 1m/5m</span><span class="h-value">${sys.load1||0} / ${sys.load5||0}</span></div>
        <div class="h-stat"><span class="h-label">Uptime</span><span class="h-value">${fmtUptime(sys.uptimeSeconds)}</span></div>`;
      grid.appendChild(cpuCard);
    }

    // RAM
    if (sys.ramPercent !== undefined) {
      const rc = sys.ramPercent > 85 ? '#e74c3c' : sys.ramPercent > 60 ? '#f39c12' : '#2ecc71';
      const ramCard = mkCard('Memory');
      ramCard.innerHTML += `<div class="h-stat"><span class="h-label">Used / Total</span><span class="h-value" style="color:${rc}">${sys.ramUsed} / ${sys.ramTotal} MB</span></div>${bar(sys.ramPercent, rc)}`;
      grid.appendChild(ramCard);
    }

    // Disks
    if (sys.disks && sys.disks.length) {
      const diskCard = mkCard('Storage');
      sys.disks.forEach(d2 => {
        const pct = parseInt(d2.percent)||0;
        const col = pct > 90 ? '#e74c3c' : pct > 75 ? '#f39c12' : '#2ecc71';
        diskCard.innerHTML += `<div style="margin-bottom:8px"><div style="font-size:8px;color:var(--muted);margin-bottom:3px">${d2.mount}</div>
          <div class="h-stat"><span class="h-label">${d2.used} / ${d2.size}</span><span class="h-value" style="color:${col}">${d2.percent}</span></div>${bar(pct,col)}</div>`;
      });
      grid.appendChild(diskCard);
    }

    // Libraries
    if (d.libraries && d.libraries.length) {
      const libCard = mkCard('Libraries');
      libCard.style.gridColumn = '1 / -1';
      libCard.innerHTML += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
        ${d.libraries.map(l=>`<div style="padding:8px;background:var(--subtle);border-radius:4px">
          <div style="font-size:8px;color:var(--accent);opacity:0.5;margin-bottom:2px">${l.type||'media'}</div>
          <div style="font-size:11px;color:var(--muted)">${l.name}</div></div>`).join('')}
      </div>`;
      grid.appendChild(libCard);
    }

    // Plugins
    if (d.plugins && d.plugins.length) {
      addCard(grid, `Plugins (${d.plugins.length})`, d.plugins.map(p => [p.name, p.version||'']));
    }

    // Integrations status
    const intCfg = await API.integrationsConfig().catch(() => ({}));
    const intCard = mkCard('Integrations');
    const integrationList = [
      ['Jellyseerr', intCfg.jellyseerr], ['Radarr', intCfg.radarr],
      ['Sonarr', intCfg.sonarr], ['Discord', intCfg.discord],
      ['Anthropic AI', intCfg.anthropic],
    ];
    integrationList.forEach(([name, active]) => {
      intCard.innerHTML += `<div class="h-stat"><span class="h-label">${name}</span><span class="h-value ${active?'good':''}"> ${active?'✓ Connected':'✗ Not set'}</span></div>`;
    });
    grid.appendChild(intCard);

    // Activity log
    if (actEl) {
      actEl.innerHTML = '';
      (d.recentActivity || []).forEach(a => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:6px 0;border-bottom:1px solid var(--border2);display:flex;justify-content:space-between;align-items:flex-start;font-size:11px;gap:12px';
        const col = a.severity === 'Error' ? 'var(--red)' : a.severity === 'Warning' ? 'var(--orange)' : 'var(--muted)';
        row.innerHTML = `<span style="color:${col};flex:1">${a.name||''}</span><span style="color:var(--muted);font-size:9px;font-family:monospace;flex-shrink:0">${a.date ? new Date(a.date).toLocaleString() : ''}</span>`;
        actEl.appendChild(row);
      });
    }
  } catch(e) { grid.innerHTML = `<div class="empty-state">${e.message}</div>`; }
}

function mkCard(title) {
  const card = document.createElement('div'); card.className = 'h-card glass-card';
  card.innerHTML = `<div class="h-card-title">${title}</div>`;
  return card;
}

function addCard(grid, title, stats) {
  const card = mkCard(title);
  stats.forEach(([label, value, cls]) => {
    if (!label && !value) return;
    card.innerHTML += `<div class="h-stat"><span class="h-label">${label}</span><span class="h-value ${cls||''}">${value||'—'}</span></div>`;
  });
  grid.appendChild(card);
}
