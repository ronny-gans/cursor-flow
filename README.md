# Cursor Flow

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)]()
[![Electron](https://img.shields.io/badge/Electron-39-47848F.svg?logo=electron&logoColor=white)]()
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933.svg?logo=node.js&logoColor=white)]()
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB.svg?logo=python&logoColor=white)]()

A free, Screen Studio–style Electron desktop app for recording and polishing app demos and presentations, with smart zoom, cursor enhancement, and clean MP4 exports.

> **Note:** Currently macOS only. Windows/Linux support is not yet available.

## What it is for

- Record short product demos, bug repros, and tutorials.
- Keep the cursor readable (replacement/overlay instead of the raw OS cursor).
- Add simple edits on a timeline (cuts, zoom events, title cards).
- Export a clean MP4 for sharing.

<img width="1390" height="945" alt="Screenshot 2025-12-12 at 16 33 46" src="https://github.com/user-attachments/assets/cb52c819-633d-4cf2-a6c7-e9f5de8ea594" />


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

### 0) Clone

```bash
git clone https://github.com/KazKozDev/cursor-flow.git
cd cursor-flow
```

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

If macOS blocks it (Gatekeeper), run one of these:

```bash
chmod +x "Start Cursor Flow.command"
./"Start Cursor Flow.command"
```

or:

```bash
bash "Start Cursor Flow.command"
```

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

## Repo layout

```
electron/                 Electron main/preload
backend/                  FastAPI + video processing
components/               React UI
services/                 API clients / integrations
App.tsx                   Main UI and timeline logic
Start Cursor Flow.command macOS launcher
```

---

If you like this project, please give it a star ⭐

For questions, feedback, or support, reach out to:

[Artem KK](https://www.linkedin.com/in/kazkozdev/) | [Apache 2.0](LICENSE)
