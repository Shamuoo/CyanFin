# CyanFin

**The best Jellyfin frontend. Docker-hosted for speed and reliability.**

CyanFin is a self-hosted web interface for [Jellyfin](https://jellyfin.org) media servers — built for home theater use. It runs as a lightweight Docker container alongside your Jellyfin instance and gives you a cinema-quality browsing and playback experience in any browser.

![CyanFin Cinema Theme](https://raw.githubusercontent.com/Shamuoo/CyanFin/main/docs/screenshot.png)

---

## Features

**Two modes, one app**

- **Display mode** — full-screen now-playing view with poster, quality badges, progress bar, cast, trailer QR code, and multi-user session awareness. Designed to run on a dedicated display.
- **Player mode** — browser-based video playback via HLS streaming, with custom controls, subtitle/audio track selection, resume from position, picture-in-picture, and keyboard shortcuts.

**Library**

- Movies, TV Shows, Music browsing with sorting, filtering by genre, and infinite scroll
- Quality badges — 4K, 1080p, 720p, 3D (auto-detected from file metadata and filename)
- Audio badges — Atmos, DTS:X, TrueHD, DTS-HD MA, DTS, DD+, DD, AAC
- Version grouping — deduplicates multi-version movies, shows all quality tags and a ×N count
- Continue Watching, Recently Added, Most Popular, Watch History, Best in 3D, On This Day, Coming Soon

**Library Tools**

- Quality report — SD files, upgrade candidates, poor audio
- Missing content — items without posters, backdrops, or overviews
- Versions & 3D report — multi-version movies, 3D library overview
- Music report — missing album artwork
- Quick Actions — trigger library scans, metadata refresh, image refresh
- AI metadata fix — uses Claude to suggest improved overviews and taglines
- Inline metadata editor — edit title, year, overview, tagline, rating, genres and save back to Jellyfin

**Server Health**

- Jellyfin connection latency
- Active sessions and transcoding count
- CPU, RAM, and disk usage (read from `/proc`)
- Library list, plugin list, recent activity log
- GitHub release check for CyanFin updates

**Themes** — five switchable themes via CSS custom properties:

| Theme | Accent | Vibe |
|---|---|---|
| Cinema | Gold | Dark luxury, default |
| Midnight | Blue | Deep cool |
| Ember | Orange-red | Warm |
| Arctic | Blue | Near-white minimal |
| Neon | Cyan/Purple | High contrast |

**Authentication** — login with your Jellyfin credentials. Sessions persist for 7 days via a secure cookie. All API calls use your personal Jellyfin token — no shared API key needed at runtime.

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
  ghcr.io/shamuoo/cyanfin:latest
```

Open `http://your-server-ip:3000` and sign in with your Jellyfin username and password.

### Unraid

1. In Unraid, go to **Docker → Add Container**
2. Set repository to `ghcr.io/shamuoo/cyanfin:latest`
3. Add environment variables: `JELLYFIN_URL` and `TMDB_API_KEY`
4. Map container port `3000` to your preferred host port
5. Apply and start

Or build from source:

```bash
mkdir /mnt/user/appdata/cyanfin
cd /mnt/user/appdata/cyanfin
git clone https://github.com/Shamuoo/CyanFin.git .
docker build -t cyanfin .
docker run -d --name cyanfin --restart unless-stopped \
  -p 3000:3000 \
  -e JELLYFIN_URL="http://192.168.1.x:8096" \
  -e TMDB_API_KEY="your_tmdb_key" \
  cyanfin
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `JELLYFIN_URL` | Yes | Full URL to your Jellyfin instance, e.g. `http://192.168.1.100:8096` |
| `TMDB_API_KEY` | No | [TMDB API key](https://www.themoviedb.org/settings/api) for trailers, Coming Soon, and On This Day |
| `PORT` | No | Port to listen on inside the container (default: `3000`) |

No `JELLYFIN_API_KEY` is needed — CyanFin authenticates as the logged-in user.

---

## Getting a TMDB API Key

1. Create a free account at [themoviedb.org](https://www.themoviedb.org)
2. Go to Settings → API → Create → Developer
3. Copy the **API Key (v3 auth)** string

TMDB powers the Coming Soon section, On This Day, and trailer QR codes. CyanFin works without it — those sections simply won't appear.

---

## Keyboard Shortcuts (Player)

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek ±10 seconds |
| `↑` / `↓` | Volume ±10% |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `Esc` | Exit player |

---

## File Structure

```
cyanfin/
├── Dockerfile
├── README.md
├── server/
│   ├── index.js          # HTTP server, routing, auth middleware
│   ├── jellyfin.js       # Jellyfin API client
│   ├── auth.js           # Session management
│   ├── tmdb.js           # TMDB API client
│   └── routes/
│       ├── api.js        # All /api/* route handlers
│       └── library.js    # /api/library/* route handlers
└── public/
    ├── index.html        # SPA shell
    ├── css/
    │   └── base.css      # Reset, themes, all component styles
    └── js/
        ├── app.js        # Router, views, home, search, library, health
        ├── api.js        # Fetch wrapper for all API calls
        ├── themes.js     # Theme switching, settings, sounds, toasts
        └── player.js     # HLS video player with custom controls
```

Zero npm dependencies at runtime. Pure Node.js standard library on the server.

---

## Updating

```bash
cd /mnt/user/appdata/cyanfin
git pull
docker build -t cyanfin .
docker restart cyanfin
```

---

## Roadmap

- [ ] TV show detail view (seasons → episode list)
- [ ] Audio player for music
- [ ] Live TV support
- [ ] Multi-profile switching
- [ ] Mobile app wrapper
- [ ] Watch together / sync playback

---

## Credits

Built with [Node.js](https://nodejs.org), [HLS.js](https://github.com/video-dev/hls.js), [QRCode.js](https://github.com/davidshimjs/qrcodejs), and [TMDB](https://www.themoviedb.org).

Media served by [Jellyfin](https://jellyfin.org) — the free software media system.

AI metadata fixes powered by [Claude](https://anthropic.com) (requires Anthropic API key in the AI Fix feature).

---

*AI-assisted project — built with Claude by Anthropic*
