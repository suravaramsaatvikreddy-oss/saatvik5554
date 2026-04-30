# Vision IQ

Vision IQ is a lightweight progressive web app prototype for AI-powered accessibility narration.

## Features

- Dual mode UI
  - **Normal Version** for general users
  - **Blind Edition (Shadow Art)** with black + neon green contrast
- Camera startup for live environment access
- Pluggable **AlphaBrain API** integration (endpoint + key)
- Speech synthesis narration playback
- "Always-On" toggle that auto-speaks each new narration
- Service worker caching to support fast launch and limited offline use

## Run locally

Because this app uses a service worker, serve it via HTTP:

```bash
python3 -m http.server 8080
```

Open: <http://localhost:8080/index.html>
