[![npm version](https://img.shields.io/docker/pulls/raiper34/spooty)](https://hub.docker.com/r/raiper34/spooty)
[![npm version](https://img.shields.io/docker/image-size/raiper34/spooty)](https://hub.docker.com/r/raiper34/spooty)
![Docker Image Version](https://img.shields.io/docker/v/raiper34/spooty)
[![npm version](https://img.shields.io/docker/stars/raiper34/spooty)](https://hub.docker.com/r/raiper34/spooty)
[![GitHub License](https://img.shields.io/github/license/raiper34/spooty)](https://github.com/Raiper34/spooty)
[![GitHub Repo stars](https://img.shields.io/github/stars/raiper34/spooty)](https://github.com/Raiper34/spooty)

![spooty logo](assets/logo.svg)
# Spooty - selfhosted Spotify downloader
Spooty is a self-hosted Spotify downloader.
It allows download track/playlist/album from the Spotify url.
It can also subscribe to a playlist or author page and download new songs upon release.
Spooty basically downloads nothing from Spotify, it only gets information from spotify and then finds relevant and downloadeds music on Youtube. 
The project is based on NestJS and Angular.

> [!IMPORTANT]
> Please do not use this tool for piracy! Download only music you own rights! Use this tool only on your responsibility.

### Content
- [🚀 Installation](#-installation)
  - [Spotify App Configuration](#spotify-app-configuration)
  - [Docker](#docker)
    - [Docker command](#docker-command)
    - [Docker compose](#docker-compose)
  - [Build from source](#build-from-source)
    - [Process](#requirements)
    - [Requirements](#process)
  - [Environment variables](#environment-variables)
  - [YouTube cookies](#youtube-cookies)
- [⚖️ License](#-license)

## 🚀 Installation
Recommended and the easiest way how to start to use of Spooty is using docker.

### Spotify App Configuration

To fully use Spooty, you need to create an application in the Spotify Developer Dashboard:

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Sign in with your Spotify account
3. Create a new application
4. Note your `Client ID` and `Client Secret`
5. Configure the redirect URI to `http://127.0.0.1:3000/api/auth/spotify/callback` (loopback IP required; `localhost` is not allowed — see [Spotify redirect URI rules](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri))

These credentials will be used by Spooty to access the Spotify API.

### Docker

Just run docker command or use docker compose configuration.
For detailed configuration, see available [environment variables](#environment-variables).

#### Docker command
The app resolves `DB_PATH` and `DOWNLOADS_PATH` under `/spooty/dist/backend` in the image.

```shell
docker run -d -p 3000:3000 \
  -v /path/to/config:/spooty/dist/backend/config \
  -v /path/to/downloads:/spooty/dist/backend/downloads \
  -v /path/to/cookies.txt:/spooty/config/cookies.txt:ro \
  -e SPOTIFY_CLIENT_ID=your_client_id \
  -e SPOTIFY_CLIENT_SECRET=your_client_secret \
  -e YT_COOKIES_FILE=/spooty/config/cookies.txt \
  -e REDIS_HOST=host.docker.internal \
  raiper34/spooty:latest
```

#### Docker compose

From the repo root, copy `.env.example` to `.env`, set Spotify credentials and volume paths, then:

```shell
docker compose up -d --build
```

The included [`docker-compose.yml`](docker-compose.yml) builds `spooty:local`, runs Redis, and mounts:

| Host | Container | Purpose |
|------|-----------|---------|
| `./config` | `/spooty/dist/backend/config` | SQLite (`DB_PATH=./config/db.sqlite`) |
| `SPOOTY_DOWNLOADS_DIR` (default `./downloads`) | `/spooty/dist/backend/downloads` | Audio files (`DOWNLOADS_PATH=./downloads`) |
| `SPOOTY_COOKIES_FILE` | `/spooty/config/cookies.txt` | YouTube cookies (read-only) |

Open **http://127.0.0.1:3000** after the stack is up. Rebuild after backend changes: `docker compose up -d --build`.

Published image example:

```yaml
services:
  spooty:
    image: raiper34/spooty:latest
    container_name: spooty
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /path/to/config:/spooty/dist/backend/config
      - /path/to/downloads:/spooty/dist/backend/downloads
      - /path/to/cookies.txt:/spooty/config/cookies.txt:ro
    environment:
      - SPOTIFY_CLIENT_ID=your_client_id
      - SPOTIFY_CLIENT_SECRET=your_client_secret
      - YT_COOKIES_FILE=/spooty/config/cookies.txt
```

### Build from source

Spooty can be also build from source files on your own.

#### Requirements
- Node v20.20.0 (it is recommended to use `nvm` node version manager to install proper version of node)
- Redis in memory cache
- Ffmpeg
- Python3

#### Process
- install Node v20.20.0 using `nvm install` and use that node version `nvm use`
- from project root install all dependencies using `npm install`
- copy `.env.default` as `.env` in `src/backend` folder and modify desired environment properties (see [environment variables](#environment-variables))
- add your Spotify application credentials to the `.env` file:
  ```
  SPOTIFY_CLIENT_ID=your_client_id
  SPOTIFY_CLIENT_SECRET=your_client_secret
  ```
- build source files `npm run build`
    - built project will be stored in `dist` folder
- start server `npm run start`

### Environment variables

Some behaviour and settings of Spooty can be configured using environment variables and `.env` file.

 Name                    | Default                                     | Description                                                                                                                                                               |
-------------------------|---------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
 DB_PATH                 | `./config/db.sqlite` (relative to backend)  | Path where Spooty database will be stored                                                                                                                                 |
 FE_PATH                 | `../frontend/browser` (relative to backend) | Path to frontend part of application                                                                                                                                      |
 DOWNLOADS_PATH          | `./downloads` (relative to backend)         | Path where downaloded files will be stored                                                                                                                                |
 FORMAT                  | `mp3`                                       | Format of downloaded files ('aac', 'flac', 'mp3', 'm4a', 'opus', 'vorbis', 'wav', 'alac')                                                                                 |
 QUALITY                 | undefined                                   | Audio quality (0-9 VBR or specific bitrate) of downloaded files                                                                                                           |
 PORT                    | 3000                                        | Port of Spooty server                                                                                                                                                     |
 REDIS_PORT              | 6379                                        | Port of Redis server                                                                                                                                                      |
 REDIS_HOST              | localhost                                   | Host of Redis server                                                                                                                                                      |
 RUN_REDIS               | false                                       | Whenever Redis server should be started from backend (recommended for Docker environment)                                                                                 |
 SPOTIFY_CLIENT_ID       | your_client_id                              | Client ID of your Spotify application (required)                                                                                                                          |
 SPOTIFY_CLIENT_SECRET   | your_client_secret                          | Client Secret of your Spotify application (required)                                                                                                                      |
 SPOTIFY_REDIRECT_URI    |                                             | Exact OAuth redirect URL (e.g. `http://127.0.0.1:3000/api/auth/spotify/callback`). Must match Spotify app settings. Enables user login for full playlist Web API access. |
 SPOTIFY_AUTH_SCOPES     | playlist-read-private playlist-read-collaborative | Space-separated OAuth scopes (optional).                                                                                                                          |
 YT_DOWNLOADS_PER_MINUTE | 3                                           | Max YouTube download **and search** jobs started per minute (queue spacing)                                                                                               |
 YT_DLP_SLEEP_INTERVAL   | 5                                           | Seconds yt-dlp waits between downloads (`--sleep-interval`)                                                                                                               |
 YT_DLP_SLEEP_REQUESTS   | unset                                       | Optional seconds yt-dlp waits between requests during extraction (`--sleep-requests`)                                                                                    |
 YT_DLP_RETRIES          | 3                                           | yt-dlp retry count for failed fragments/requests                                                                                                                          |
 YT_SKIP_BURST_LIMIT     | 5                                           | After this many consecutive skips (output file already on disk), pause before the next download job (see `YT_SKIP_BURST_COOLDOWN_MS`)                                     |
 YT_SKIP_BURST_COOLDOWN_MS | 60000                                     | Extra milliseconds to wait when the skip burst limit is reached                                                                                                         |
 YT_COOKIES              |                                             | Browser name to automatically extract YouTube cookies from (e.g. `chrome`, `firefox`). Only works when running Spooty natively (not in Docker). See [below](#yt_cookies---browser-based-cookies-non-docker). |
 YT_COOKIES_FILE         | `./config/cookies.txt`                      | Path to a Netscape-format `cookies.txt` file. Recommended for Docker deployments. See [below](#yt_cookies_file---cookies-file-recommended-for-docker).                    |

### Spotify user login (Web API)

Spotify **client credentials** cannot read many user playlists (403). Set `SPOTIFY_REDIRECT_URI` to a loopback URL (e.g. `http://127.0.0.1:3000/api/auth/spotify/callback`) and add the same URI in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), then open Spooty at **`http://127.0.0.1:3000`** and use **Connect Spotify** (or `/api/auth/spotify/login`). A **refresh token** is stored in your SQLite database (`DB_PATH`); keep that file private. Playlist and track Web API calls use your user token when linked. `GET /api/auth/spotify/status` returns `{ "linked": boolean }`.

### YouTube cookies

YouTube may block or throttle downloads without authentication cookies. Spooty supports two ways to provide them — use the one that fits your setup.

#### `YT_COOKIES` — browser-based cookies (non-Docker)

Set `YT_COOKIES` to the name of your browser and yt-dlp will automatically read cookies directly from it.
Supported values: `chrome`, `firefox`, `edge`, `safari`, `brave`, `opera`, `chromium`.

```
YT_COOKIES=chrome
```

> [!NOTE]
> This only works when Spooty runs on the same machine as your browser (i.e. not in Docker, where no browser is present).

#### `YT_COOKIES_FILE` — cookies file (recommended for Docker)

Set `YT_COOKIES_FILE` to the in-container path (e.g. `/spooty/config/cookies.txt`). Bind-mount a Netscape `cookies.txt` from the host; a symlink is fine (overwrite the target file). Spooty reads it on each download — no container restart needed after you replace the file.

**How to get your `cookies.txt` file** ([yt-dlp wiki](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies)):

1. New **private/incognito** window; log into YouTube (throwaway account recommended).
2. Same tab only: open `https://www.youtube.com/robots.txt`.
3. Export `youtube.com` cookies with [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) or [cookies.txt for Firefox](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/).
4. Close incognito; do not use that account in a normal browser while Spooty runs.

Do **not** use `yt-dlp --cookies-from-browser … --cookies file` for the incognito session — that exports your regular browser cookies.

**Long playlists:** Prefer `YT_DOWNLOADS_PER_MINUTE=3`, defaults for `YT_DLP_SLEEP_INTERVAL` / `YT_DLP_RETRIES`, and re-export cookies if you see HTTP 302 or sign-in errors. Use **retry failed** in the UI. If a non-empty output file is already on disk (same playlist folder and filename), Spooty marks the track **Completed** without YouTube search or download. Zero-byte files are treated as missing and will be downloaded again.

Verify (optional): `docker exec spooty /spooty/node_modules/ytdlp-nodejs/bin/yt-dlp --cookies /spooty/config/cookies.txt --simulate -f ba "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`

> [!NOTE]
> `YT_COOKIES` takes priority over `YT_COOKIES_FILE` if both are set.

# ⚖️ License
[MIT](https://choosealicense.com/licenses/mit/)
