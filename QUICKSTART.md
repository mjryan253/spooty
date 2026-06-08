# Spooty Quickstart (Docker) — from clone to an MP3

Run Spooty in a single Docker container and download your first song from the web UI on
`localhost`. The image bundles everything it needs — **ffmpeg, Python, and
[spotDL](https://github.com/spotDL/spotify-downloader) `4.5.0`** — so you don't install Node,
Python, or spotdl yourself. **No Redis, no database server.**

Spooty pulls track metadata from Spotify, then spotdl finds the audio on YouTube Music,
downloads it, converts it, and embeds tags + cover art.

> Legal: only download music you have the right to. See the note in [README.md](README.md).

---

## What you need

- **Docker** (Engine 20.10+ with Compose v2, or any recent Docker Desktop)
- A free **Spotify app** (Client ID + Secret) — created in step 3

---

## 1. Clone the repo

```bash
git clone https://github.com/Raiper34/spooty.git
cd spooty
```

## 2. Build the image

This repo's version isn't published, so build it locally. The Dockerfile compiles the
frontend + backend and installs spotdl/ffmpeg inside the image:

```bash
docker build -t spooty:local .
```

(First build takes a few minutes; later builds are cached.)

## 3. Create a Spotify app (for metadata)

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → **Create app**.
2. Copy the **Client ID** and **Client Secret**.
3. *(Optional — only for **private/collaborative** playlists)* add this Redirect URI in the app
   settings (loopback IP is required; `localhost` is rejected):
   `http://127.0.0.1:3000/api/auth/spotify/callback`

## 4. Run the container

Pick a folder on your machine for the downloads, then start Spooty:

```bash
mkdir -p ~/Music/spooty

docker run -d --name spooty \
  -p 3000:3000 \
  -v ~/Music/spooty:/spooty/backend/downloads \
  -e SPOTIFY_CLIENT_ID=your_client_id \
  -e SPOTIFY_CLIENT_SECRET=your_client_secret \
  -e FORMAT=mp3 \
  spooty:local
```

- `-p 3000:3000` exposes the web UI on your machine.
- `-v ~/Music/spooty:/spooty/backend/downloads` is where finished files appear on the host.
- `FORMAT` can be `mp3 | flac | ogg | opus | m4a | wav`.

Check it's up:

```bash
docker logs spooty | tail -n 5      # look for: Nest application successfully started
curl -s http://localhost:3000/api    # -> ONLINE
```

## 5. Open the web UI

Go to **http://localhost:3000** in your browser.

*(Optional)* For private playlists, click **Connect Spotify** and approve access — this requires
the Redirect URI from step 3.

## 6. Download a song

In the UI, paste a Spotify URL (track, album, playlist, or artist) and submit. For example a
single track:

```
https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8
```

Watch the status move **Queued → Downloading → Completed**. Click the download button to save
it through the browser, or just grab it from your mounted folder (next step).

> Prefer the terminal? `curl -s -X POST http://localhost:3000/api/playlist -H 'Content-Type: application/json' -d '{"spotifyUrl":"https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8"}'`

## 7. You have an MP3 🎵

Files appear in the host folder you mounted:

- **Single track** → directly in the folder root.
- **Playlist** → in a subfolder named after the playlist.

```bash
ls -la ~/Music/spooty/
# Rick Astley - Never Gonna Give You Up.mp3   (tags + cover art embedded)
```

---

## Persisting login & subscriptions (optional)

The SQLite DB (Spotify refresh token + your playlists/subscriptions) lives at
`/spooty/backend/config` inside the container. To keep it across `docker rm`, also mount it:

```bash
-v ~/Music/spooty-config:/spooty/backend/config
```

## YouTube cookies (optional, if downloads get throttled)

Export a Netscape `cookies.txt` (see README → *YouTube cookies*), then add:

```bash
-v /path/to/cookies.txt:/spooty/config/cookies.txt \
-e YT_COOKIES_FILE=/spooty/config/cookies.txt
```

## Using Docker Compose instead

A ready-to-use [docker-compose.example.yml](docker-compose.example.yml) is included. `docker-compose.yml`
itself is gitignored (it's environment-specific), so copy the example and provide your creds:

```bash
cp docker-compose.example.yml docker-compose.yml   # adjust volume paths if you like
cp .env.example .env                                # set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
docker compose up -d --build
```

Then continue from step 5. Downloads land in `./downloads` and the login/subscriptions DB
persists in `./config`.

## Useful commands

```bash
docker logs -f spooty     # follow logs / watch downloads
docker stop spooty        # stop
docker start spooty       # start again
docker rm -f spooty       # remove (downloads persist in your mounted folder)
```

## Troubleshooting

- **`curl http://localhost:3000/api` not `ONLINE`** — `docker logs spooty` for the startup error.
- **Track ends in `Error`** — check `docker logs spooty`; usually a YouTube match/throttle issue
  (add cookies above).
- **Private playlist empty / 403** — set the Redirect URI (step 3) and click **Connect Spotify**
  in the UI before importing.
