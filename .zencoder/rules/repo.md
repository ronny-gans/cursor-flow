---
description: Repository Information Overview
alwaysApply: true
---

# Cursor Flow Repository Information

## Summary
Cursor Flow is a Cursor Flow-style video editor with physics-based cursor animation and high-quality video export. It combines a React/Electron frontend with a Python FastAPI backend for video processing. The application features AI-powered smart zoom using Gemini API, timeline editing, and OpenCV-based video processing with ffmpeg encoding.

## Repository Structure

```
├── App.tsx                              # Main React application
├── components/                          # React UI components
│   ├── EditorCanvas.tsx
│   └── PhysicsControls.tsx
├── services/                            # TypeScript service layers
│   ├── geminiService.ts                 # Gemini AI integration
│   └── videoProcessingService.ts        # Backend API client
├── backend/                             # Python FastAPI server
│   ├── main.py                          # FastAPI application
│   └── video_processor.py               # OpenCV video processing
├── cursor-replacer/                     # Reference cursor replacement CLI tool
├── electron/                            # Electron main/preload processes
├── dist-electron/                       # Electron build output
├── index.html                           # HTML entry point
├── index.tsx                            # React entry point
├── forge.config.js                      # Electron Forge configuration
├── vite.config.ts                       # Vite build configuration
└── tsconfig.json                        # TypeScript configuration
```

## Main Components

- **Frontend**: React 19 with TypeScript, running on Vite dev server (port 3000) and packaged with Electron Forge
- **Backend**: Python FastAPI server (port 8000) for video processing using OpenCV and ffmpeg
- **Electron**: Desktop application wrapper using Electron Forge with auto-update support
- **Cursor Replacer**: Standalone Python CLI tool for cursor detection and replacement (reference implementation)

## Language & Runtime

**Frontend**:
- **Language**: TypeScript (ES2022 target)
- **Runtime**: Node.js v18+
- **Framework**: React 19.2.1
- **Build Tool**: Vite 6.2.0
- **Desktop**: Electron 39.2.6 with Electron Forge 7.10.2

**Backend**:
- **Language**: Python 3.9+
- **Framework**: FastAPI 0.104.0+
- **Server**: Uvicorn 0.24.0+
- **Required System**: ffmpeg (for video encoding)

**Cursor Replacer** (CLI tool):
- **Language**: Python 3.9+
- **No framework**, pure script-based

## Dependencies

### Frontend Dependencies
- **@google/genai**: ^1.32.0 (Gemini API integration)
- **react**: ^19.2.1, **react-dom**: ^19.2.1
- **framer-motion**: ^12.23.25 (animations)
- **lucide-react**: ^0.556.0 (icons)
- **robotjs**: ^0.6.0 (cursor automation)
- **electron-squirrel-startup**: ^1.0.1

### Frontend Dev Dependencies
- **@electron-forge/cli**, **@electron-forge/plugin-vite**: ^7.10.2
- **@electron-forge/maker-**{squirrel,deb,rpm,zip}: ^7.10.2
- **@electron/fuses**, **@electron/rebuild**: ^1.8.0, ^3.7.2
- **typescript**: ~5.8.2
- **@vitejs/plugin-react**: ^5.0.0
- **@types/node**: ^22.19.2
- **concurrently**, **wait-on**: ^9.2.1, ^9.0.3

### Backend Dependencies
- **fastapi**: >=0.104.0
- **uvicorn**: >=0.24.0
- **python-multipart**: >=0.0.6
- **opencv-python**: >=4.8.0
- **numpy**: >=1.24.0
- **pydantic**: >=2.0.0

### Cursor Replacer Dependencies
- **opencv-python**: >=4.8.0
- **numpy**: >=1.24.0
- **mss**: >=9.0.0 (screenshot capture)
- **pynput**: >=1.7.0 (cursor tracking)

## Build & Installation

### Prerequisites
- Node.js v18+
- Python 3.9+
- ffmpeg (required for backend video encoding)
  - macOS: `brew install ffmpeg`
  - Ubuntu: `sudo apt install ffmpeg`

### Installation & Startup

**Option 1: Full App (All services)**
```bash
./start-all.sh
```
Starts backend (FastAPI on port 8000) and frontend (Vite on port 5173/3000) concurrently.

**Option 2: Frontend Only**
```bash
npm install
npm run dev
```
Runs Vite dev server on port 3000.

**Option 3: Backend Only**
```bash
./start-backend.sh
```
Starts FastAPI server with hot-reload on port 8000.

### Build Commands

**Frontend Build**:
```bash
npm run build
```
Produces optimized Vite bundle.

**Desktop App Packaging**:
```bash
npm run package     # Create distributable package
npm run make        # Create installer (squirrel/deb/rpm/zip)
```

**Backend**: No build step required; runs directly with uvicorn.

### Dependency Management
- **Frontend**: npm (package.json, package-lock.json)
- **Backend**: pip (requirements.txt)

## Configuration

### Environment Variables
- **GEMINI_API_KEY**: Required for AI-powered zoom features (set in `.env.local`)
- Configured in `vite.config.ts` as `process.env.GEMINI_API_KEY`

### Electron Configuration
- **forge.config.js**: Configures packaging for macOS (zip), Windows (squirrel), and Linux (deb/rpm)
- Fuses enabled: cookie encryption, ASAR integrity validation, app-only ASAR loading

### FastAPI CORS
Backend configured for CORS from localhost:5173, localhost:3000, localhost:3001, and 127.0.0.1:5173.

## API Endpoints (Backend)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/process` | POST | Process video with cursor overlay |
| `/api/detect` | POST | Detect cursor in video (CV) |
| `/api/status/{job_id}` | GET | Get processing status |
| `/api/download/{job_id}` | GET | Download processed video |
| `/api/cursor-styles` | GET | List available cursor styles |

## Entry Points

- **Frontend**: `index.tsx` (React) → `index.html`
- **Electron Main**: `electron/main.cjs` → package.json `"main": "electron/main.js"`
- **Electron Preload**: `electron/preload.js`
- **Backend**: `backend/main.py` (FastAPI app instance)
- **Cursor Replacer CLI**: `cursor-replacer/cursor_replacer.py` (command-line script)

## Key Files & Resources

**Frontend Configuration**:
- `vite.config.ts`: Vite build config with React plugin, API key injection
- `vite.main.config.mjs`, `vite.preload.config.mjs`, `vite.renderer.config.mjs`: Electron-specific Vite configs
- `tsconfig.json`: TypeScript target ES2022, React JSX support, path aliases

**Backend Configuration**:
- `backend/main.py`: FastAPI app with CORS, job tracking, temp file storage
- `backend/video_processor.py`: OpenCV frame processing, cursor replacement logic

**Desktop Packaging**:
- `forge.config.js`: Electron Forge makers and plugins (ZIP, Squirrel, DEB, RPM)
- `electron.d.ts`: TypeScript type definitions for Electron

**Scripts**:
- `start-all.sh`: Unified startup (both services)
- `start-backend.sh`: Backend only with hot-reload
- `start.sh`: macOS startup with port cleanup and browser launch

## Testing & Validation

No traditional test framework configured. The project uses manual testing with reference test files in `cursor-replacer/` directory (test_*.mp4, test_*.png files).

To validate backend video processing, reference outputs are available:
- `cursor-replacer/test_output.mp4`
- `cursor-replacer/test_backend_output.mp4`
- `cursor-replacer/test_cursor_output.mp4`

## Development Notes

- Frontend uses `concurrently` to run Vite and Electron dev servers simultaneously
- Backend runs with `--reload` flag during development for hot-reloading on code changes
- Python virtual environment (`venv/`) is auto-created by start scripts
- Temp video processing files stored in system temp directory: `/tmp/cursor_flow/` (macOS/Linux)
- RobotJS used for cursor automation; robotjs native modules require rebuild on Electron rebuild
