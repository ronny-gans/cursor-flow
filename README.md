# Cursor Flow

Desktop (Electron) screen recorder + timeline editor.

## What it is for

- Record short product demos, bug repros, and tutorials.
- Keep the cursor readable (replacement/overlay instead of the raw OS cursor).
- Add simple edits on a timeline (cuts, zoom events, title cards).
- Export a clean MP4 for sharing.

## Non-goals

- Not a full NLE (no multi-track audio edit, no color grading).
- Not a live streaming tool.
- Not a browser app; development and usage are desktop-first (Electron).

## Alternatives

Closest tools, depending on what you need:

- **Screen Studio**: polished macOS screen recording with automatic emphasis.
- **ScreenFlow / Camtasia**: traditional editors for heavier post-production.
- **OBS**: live capture/streaming and complex scene setups.
- **Loom**: fast “record and share” with cloud workflows.
- **CleanShot X / Kap**: quick capture utilities (lightweight, fewer edits).

## Requirements

- Node.js 18+
- Python 3.10+
- ffmpeg
  - macOS: `brew install ffmpeg`

## Setup

### 1) Install Node deps

```bash
npm install
```

### 2) Backend (Python)

Create a virtualenv and install backend requirements.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Optional (AI zoom suggestions):

Create `.env.local`:

```bash
GEMINI_API_KEY=...
```

## Run

### macOS (recommended)

Double‑click:

`Start Cursor Flow.command`

What it does:

- Starts the backend on `http://localhost:8000`
- Starts Electron in dev mode

### Manual (2 terminals)

Backend:

```bash
./start-backend.sh
```

Electron:

```bash
npm run dev
```

## Permissions (macOS)

Recording and camera require OS permissions.

- Screen Recording
  - System Settings -> Privacy & Security -> Screen Recording
- Camera
  - System Settings -> Privacy & Security -> Camera

If capture fails, restart the app after granting permission.

## Export

- MP4 export uses the Python backend (`ffmpeg` required).
- Export captures the edited canvas (clean mode) and sends it to the backend for processing.

## Project save

Top-right icons:

- Save: writes a project JSON file via native save dialog.
- Show in Folder: reveals the last saved project file in Finder.

Note: recorded clips saved as `blob:` URLs are not persisted in the project file.

## Build (macOS)

```bash
npm run make
```

Artifacts:

- `out/make/**.dmg` (installer)
- `out/make/**.zip`

## Repo layout

```
electron/                 Electron main/preload
backend/                  FastAPI + video processing
components/               React UI
services/                 API clients / integrations
App.tsx                   Main UI and timeline logic
Start Cursor Flow.command macOS launcher
```
