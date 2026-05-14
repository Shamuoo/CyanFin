# CyanFin

> ⚠️ **AI-Generated Project** — CyanFin is built entirely with [Claude](https://anthropic.com) by Anthropic. All code, architecture, and documentation is AI-assisted. This is an experimental project — use at your own discretion, review code before deploying in sensitive environments, and expect rough edges.

---

**The best Jellyfin frontend. Docker-hosted for speed and reliability.**

CyanFin is a self-hosted web interface for [Jellyfin](https://jellyfin.org) media servers built for home theater use. It runs as a lightweight Docker container alongside your Jellyfin instance and gives you a cinema-quality browsing and playback experience from any browser — with integrations for Jellyseerr, Radarr, Sonarr, Discord, and more.

---

## Features

### 🎬 Playback
- **Smart stream negotiation** — uses Jellyfin's PlaybackInfo API to select direct play, direct stream, or transcode automatically
- Play method badge shows `DirectPlay · mkv`, `Transcode · ts` etc. in the player
- Resume from last position
- Fallback "Open in Jellyfin" button if playback fails
- Keyboard shortcuts: `Space`/`K` play/pause, `←`/`→` seek, `↑`/`↓` volume, `F` fullscreen, `M` mute, `Esc` exit

### 🏠 Home Screen
- Hero backdrop cycles through recently added items every 8 seconds
- Scrolling ticker bar with clickable movie pills
- Sections: Continue Watching, Recently Added, Most Popular, Watch History, Best in 3D, On This Day, Coming Soon, Feeling Lucky
- Stats strip: total movies, shows, episodes, songs

### 🎥 Movies & TV
- Full grid with sort, filter by genre, infinite scroll
- TV shows → seasons → episode list with play buttons and progress bars
- Quality badges: 4K (gold), 1080p (blue), 720p (grey), 3D (green)
- Audio badges: Atmos, DTS:X, TrueHD, DTS-HD MA, DTS, DD+, DD, AAC
- Version grouping with ×N count badge
- Multi-version movies deduplicated, all quality tags shown

### 📋 Detail Pages
- Always fullscreen with backdrop image
- Logo image overlay, multiple backdrop gallery with dot navigation
- Full cast grid with photos and roles
- Extras section (behind the scenes, featurettes, trailers stored in Jellyfin)
- Jellyseerr request button
- Discord share button
- Open in Jellyfin link

### 🎵 Music
- Album grid → track list
- Full audio queue player with play/pause/prev/next/shuffle/repeat
- Persistent audio bar slides up from the bottom while playing

### 📊 Statistics
- Watch time bar chart (last 30 days)
- Top genres breakdown
- Most watched movies
- Radarr/Sonarr download queue
- Estimated total watch hours

### 🔧 Library Tools
- Quality report: SD files, upgrade candidates, poor audio
- Missing content: no poster, no backdrop, no overview
- Versions & 3D report
- Music report with missing artwork
- Quick actions: scan, refresh metadata, fix images
- Inline metadata editor with AI fix (requires Anthropic API key)
- Bulk AI fix for all items missing overviews

### 📡 Server Health
- Jellyfin connection latency and server info
- CPU, RAM, disk usage (read from `/proc`)
- Active sessions and transcoding count
- Integration connection status (Jellyseerr, Radarr, Sonarr, Discord, Anthropic)
- Recent activity log
- GitHub release check

### 🎨 Themes
| Theme | Accent | Style |
|---|---|---|
| Cinema | Gold | Dark luxury (default) |
| Midnight | Blue | Deep cool |
| Ember | Orange-red | Warm |
| Arctic | Blue | Near-white minimal |
| Neon | Cyan/Purple | High contrast |

### ⚙️ Modes & Layouts
- **Advanced mode** — all features, badges, library tools, health tab
- **Simple mode** — clean browsing only, no technical details
- **Desktop / TV / Mobile** layouts — TV mode optimised for 10-foot viewing with larger cards, focus rings, and bigger controls

---

## Quick Start

### Docker (recommended)

```bash
docker run -d \
  --name cyanfin \
  --restart unless-stopped \
  -p 3000:3000 \
  -e JELLYFIN_URL="http://your-jellyfin-ip:8096" \
  -e TMDB_API_KEY="your_tmdb_key" \
  cyanfin
```

Open `http://your-server-ip:3000` and sign in with your Jellyfin username and password.

### Full setup with all integrations

```bash
docker run -d \
  --name cyanfin \
  --restart unless-stopped \
  -p 3000:3000 \
  -e JELLYFIN_URL="http://192.168.1.x:8096" \
  -e TMDB_API_KEY="your_tmdb_key" \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e JELLYSEERR_URL="http://192.168.1.x:5055" \
  -e JELLYSEERR_API_KEY="your_jellyseerr_key" \
  -e RADARR_URL="http://192.168.1.x:7878" \
  -e RADARR_API_KEY="your_radarr_key" \
  -e SONARR_URL="http://192.168.1.x:8989" \
  -e SONARR_API_KEY="your_sonarr_key" \
  -e DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." \
  cyanfin
```

### Unraid

1. **Docker → Add Container**
2. Repository: your built image or `ghcr.io/shamuoo/cyanfin:latest`
3. Add environment variables (see table below)
4. Map port `3000` to your preferred host port
5. Apply and start

### Build from source

```bash
mkdir /mnt/user/appdata/cyanfin
cd /mnt/user/appdata/cyanfin
git clone https://github.com/Shamuoo/CyanFin.git .
docker build -t cyanfin .
docker run -d --name cyanfin --restart unless-stopped \
  -p 3001:3000 \
  -e JELLYFIN_URL="http://192.168.1.x:8096" \
  cyanfin
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JELLYFIN_URL` | ✅ Yes | Full URL to Jellyfin, e.g. `http://192.168.1.100:8096` |
| `TMDB_API_KEY` | No | [TMDB](https://www.themoviedb.org/settings/api) key — enables trailers, Coming Soon, On This Day |
| `ANTHROPIC_API_KEY` | No | [Anthropic](https://console.anthropic.com) key — enables AI metadata fix |
| `JELLYSEERR_URL` | No | Jellyseerr URL — enables media requests from detail pages |
| `JELLYSEERR_API_KEY` | No | Jellyseerr API key |
| `RADARR_URL` | No | Radarr URL — enables download queue in stats |
| `RADARR_API_KEY` | No | Radarr API key |
| `SONARR_URL` | No | Sonarr URL — enables download queue in stats |
| `SONARR_API_KEY` | No | Sonarr API key |
| `DISCORD_WEBHOOK_URL` | No | Discord webhook — enables share button on detail pages |
| `PORT` | No | Port inside container (default: `3000`) |

No `JELLYFIN_API_KEY` needed — CyanFin authenticates as the logged-in user.

---

## Updating

```bash
cd /mnt/user/appdata/cyanfin && git pull && docker restart cyanfin
```

If server files changed, `docker restart` picks them up via volume mount.
If `Dockerfile` changed, do a full rebuild:

```bash
docker stop cyanfin && docker rm cyanfin
docker build --no-cache -t cyanfin .
# then docker run ...
```

---

## Getting API Keys

**TMDB** — free at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api). Use the v3 API Key.

**Anthropic** — [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys). Used only for AI metadata fix — never expose this key in a public environment.

**Jellyseerr** — Settings → General → API Key inside your Jellyseerr instance.

**Radarr/Sonarr** — Settings → General → API Key inside each app.

**Discord** — Server Settings → Integrations → Webhooks → New Webhook.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek ±10 seconds |
| `↑` / `↓` | Volume ±10% |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `Esc` | Exit player / close modal |
| `Ctrl+K` | Open search |

---

## File Structure

```
cyanfin/
├── Dockerfile
├── README.md
├── server/
│   ├── index.js              # HTTP server, auth, routing
│   ├── jellyfin.js           # Jellyfin API client
│   ├── auth.js               # Session management
│   ├── tmdb.js               # TMDB API client
│   └── routes/
│       ├── api.js            # Media endpoints + PlaybackInfo
│       ├── library.js        # Library tools endpoints
│       ├── integrations.js   # Jellyseerr, Radarr, Sonarr, Discord
│       └── stats.js          # Watch stats aggregation
└── public/
    ├── index.html            # SPA shell
    ├── css/
    │   └── base.css          # Themes, components, layouts
    └── js/
        ├── app.js            # Router, auth, nav (~360 lines)
        ├── api.js            # All API fetch calls
        ├── themes.js         # Theme switching, settings, toasts
        ├── player.js         # Video player with PlaybackInfo
        └── views/
            ├── home.js       # Home, hero, sections, screensaver, ticker
            ├── detail.js     # Detail modal, extras, integrations
            ├── movies.js     # Movies grid + filters
            ├── shows.js      # TV shows, seasons, episodes
            ├── music.js      # Audio player + queue
            ├── stats.js      # Watch stats, graphs, download queue
            ├── health.js     # Server health page
            └── library.js    # Library tools + AI fix
```

Zero npm runtime dependencies. Pure Node.js standard library on the server.

---

## Roadmap

- [ ] Skip intro/outro (Jellyfin segment API)
- [ ] Chapter markers on player scrub bar
- [ ] Scrub preview thumbnails (trickplay)
- [ ] In-player episode list
- [ ] Sleep timer
- [ ] Subtitle track switching in player
- [ ] TV app (Electron / WebOS / Tizen)
- [ ] Multi-user profile switching
- [ ] Watch together / sync playback
- [ ] Last.fm / ListenBrainz scrobbling
- [ ] Live TV support
- [ ] Parental controls

---

## License

GPL-3.0 — same as Jellyfin.

---

## Credits

Built with [Node.js](https://nodejs.org), [HLS.js](https://github.com/video-dev/hls.js), [QRCode.js](https://github.com/davidshimjs/qrcodejs), [TMDB](https://www.themoviedb.org), and [Jellyfin](https://jellyfin.org).

AI metadata powered by [Claude](https://anthropic.com) (Anthropic).

> *This entire project — every line of code, every design decision, every feature — was built through conversation with Claude by Anthropic. It is an experiment in what AI-assisted development can produce for a real, self-hosted home theater use case.*
