import API from '../api.js';

export async function loadStats() {
  const grid = document.getElementById('stats-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-spinner" style="grid-column:1/-1"></div>';

  try {
    const [summary, watchTime, genres, topMovies] = await Promise.all([
      API.statsSummary(),
      API.watchTime(30),
      API.topGenres(),
      API.topMovies(),
    ]);

    grid.innerHTML = '';

    // Summary cards
    const summaryData = [
      { label: 'Movies Watched', value: (summary.moviesWatched || 0).toLocaleString(), icon: '🎬' },
      { label: 'Episodes Watched', value: (summary.episodesWatched || 0).toLocaleString(), icon: '📺' },
      { label: 'Songs Played', value: (summary.songsPlayed || 0).toLocaleString(), icon: '🎵' },
      { label: 'Est. Watch Time', value: (summary.estimatedHours || 0).toLocaleString() + 'h', icon: '⏱' },
    ];
    summaryData.forEach(s => {
      const card = document.createElement('div'); card.className = 'h-card glass-card';
      card.innerHTML = `<div style="font-size:24px;margin-bottom:6px">${s.icon}</div>
        <div class="h-big">${s.value}</div>
        <div style="font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--muted);margin-top:4px">${s.label}</div>`;
      grid.appendChild(card);
    });

    // Watch time chart
    if (watchTime && watchTime.length) {
      const chartCard = document.createElement('div'); chartCard.className = 'h-card glass-card'; chartCard.style.gridColumn = '1 / -1';
      chartCard.innerHTML = '<div class="h-card-title">Watch Time — Last 30 Days (minutes)</div>';
      const chartWrap = document.createElement('div'); chartWrap.style.cssText = 'height:120px;display:flex;align-items:flex-end;gap:3px;padding:8px 0 0';
      const maxVal = Math.max(...watchTime.map(d => d.minutes), 1);
      watchTime.forEach(day => {
        const bar = document.createElement('div'); bar.style.cssText = `flex:1;background:var(--accent);opacity:${day.minutes > 0 ? '0.7' : '0.1'};border-radius:2px 2px 0 0;height:${Math.max(2, (day.minutes / maxVal) * 100)}%;transition:opacity 0.2s;cursor:default`;
        bar.title = day.date + ': ' + day.minutes + ' min';
        bar.addEventListener('mouseover', () => bar.style.opacity = '1');
        bar.addEventListener('mouseout', () => bar.style.opacity = day.minutes > 0 ? '0.7' : '0.1');
        chartWrap.appendChild(bar);
      });
      chartCard.appendChild(chartWrap);
      // x-axis labels (first, middle, last)
      const labels = document.createElement('div'); labels.style.cssText = 'display:flex;justify-content:space-between;margin-top:4px';
      if (watchTime.length) {
        [watchTime[0], watchTime[Math.floor(watchTime.length/2)], watchTime[watchTime.length-1]].forEach(d => {
          const lbl = document.createElement('div'); lbl.style.cssText = 'font-size:8px;color:var(--muted)';
          lbl.textContent = d ? new Date(d.date).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : '';
          labels.appendChild(lbl);
        });
      }
      chartCard.appendChild(labels);
      grid.appendChild(chartCard);
    }

    // Top genres
    if (genres && genres.length) {
      const genreCard = document.createElement('div'); genreCard.className = 'h-card glass-card'; genreCard.style.gridColumn = 'span 2';
      genreCard.innerHTML = '<div class="h-card-title">Top Genres</div>';
      const maxCount = genres[0].count;
      genres.slice(0, 8).forEach(g => {
        const row = document.createElement('div'); row.style.cssText = 'margin-bottom:8px';
        row.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="font-size:10px;color:var(--muted)">${g.genre}</span><span style="font-size:10px;color:var(--accent)">${g.count}</span></div>
          <div class="h-bar"><div class="h-bar-fill" style="width:${Math.round(g.count/maxCount*100)}%;background:var(--accent)"></div></div>`;
        genreCard.appendChild(row);
      });
      grid.appendChild(genreCard);
    }

    // Top movies
    if (topMovies && topMovies.length) {
      const movCard = document.createElement('div'); movCard.className = 'h-card glass-card'; movCard.style.gridColumn = 'span 2';
      movCard.innerHTML = '<div class="h-card-title">Most Watched Movies</div>';
      const list = document.createElement('div'); list.style.cssText = 'display:flex;flex-direction:column;gap:8px';
      topMovies.forEach((m, i) => {
        const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:10px';
        row.innerHTML = `<div style="font-family:var(--font-display);font-size:18px;color:var(--accent);opacity:0.3;width:24px;text-align:right">${i+1}</div>
          <img src="${m.posterUrl}" style="width:28px;height:42px;object-fit:cover;border-radius:2px;flex-shrink:0" onerror="this.style.display='none'" />
          <div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:700;color:var(--cream);opacity:0.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.title}</div>
          <div style="font-size:9px;color:var(--muted)">${m.playCount} play${m.playCount !== 1 ? 's' : ''}</div></div>`;
        list.appendChild(row);
      });
      movCard.appendChild(list);
      grid.appendChild(movCard);
    }

    // Radarr/Sonarr download queue
    const intCfg = await API.integrationsConfig().catch(() => ({}));
    if (intCfg.radarr || intCfg.sonarr) {
      const dlCard = document.createElement('div'); dlCard.className = 'h-card glass-card'; dlCard.style.gridColumn = '1 / -1';
      dlCard.innerHTML = '<div class="h-card-title">Download Queue</div>';
      const rows = [];
      if (intCfg.radarr) {
        const rs = await API.radarrStatus().catch(() => ({}));
        (rs.downloading || []).forEach(d => rows.push({ ...d, source: 'Radarr' }));
        if (rs.missing) { const m = document.createElement('div'); m.style.cssText = 'font-size:9px;color:var(--muted);margin-bottom:8px'; m.textContent = `Radarr: ${rs.missing} monitored movies missing`; dlCard.appendChild(m); }
      }
      if (intCfg.sonarr) {
        const ss = await API.sonarrStatus().catch(() => ({}));
        (ss.downloading || []).forEach(d => rows.push({ ...d, source: 'Sonarr' }));
      }
      if (rows.length) {
        rows.forEach(d => {
          const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px';
          row.innerHTML = `<div style="flex:1;min-width:0"><div style="font-size:11px;color:var(--cream);opacity:0.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.title}</div>
            <div style="font-size:9px;color:var(--muted)">${d.source} · ${d.status || 'downloading'}</div>
            <div class="h-bar" style="margin-top:3px"><div class="h-bar-fill" style="width:${d.progress || 0}%;background:var(--accent)"></div></div></div>
            <div style="font-size:10px;color:var(--accent);flex-shrink:0">${d.progress || 0}%</div>`;
          dlCard.appendChild(row);
        });
      } else {
        dlCard.innerHTML += '<div style="font-size:11px;color:var(--muted);font-style:italic">Queue is empty</div>';
      }
      grid.appendChild(dlCard);
    }

  } catch(e) { grid.innerHTML = `<div class="empty-state">${e.message}</div>`; }
}
