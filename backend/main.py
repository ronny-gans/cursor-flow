"""
Cursor Flow Backend - Video Processing API
Handles cursor replacement and video encoding via OpenCV + ffmpeg
"""

import os
import json
import tempfile
import uuid
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import asyncio

from .video_processor import process_video_with_cursor, detect_cursor_positions, CursorStyle

app = FastAPI(
    title="Cursor Flow Backend",
    description="Video processing API for cursor replacement and encoding",
    version="1.0.0"
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temp storage for processed videos
TEMP_DIR = Path(tempfile.gettempdir()) / "cursor_flow"
TEMP_DIR.mkdir(exist_ok=True)

# Track processing jobs
processing_jobs: dict[str, dict] = {}


class CursorPoint(BaseModel):
    x: float  # 0-1 normalized
    y: float  # 0-1 normalized
    time: float  # seconds


class ProcessRequest(BaseModel):
    cursor_data: list[CursorPoint]
    cursor_style: str = "fancy"  # fancy, macos, circle, dot, ring, crosshair
    cursor_size: int = 48
    cursor_color: str = "white"
    smooth: bool = True
    quality: str = "high"  # high, balanced, fast


@app.get("/")
async def root():
    return {"status": "ok", "service": "Cursor Flow Backend"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/process")
async def process_video(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    cursor_data: str = Form(...),  # JSON string of CursorPoint[]
    cursor_style: str = Form("fancy"),
    cursor_size: int = Form(48),
    cursor_color: str = Form("white"),
    smooth: bool = Form(True),
    quality: str = Form("high")
):
    """
    Process uploaded video with cursor overlay.
    Returns job_id for polling status.
    """
    job_id = str(uuid.uuid4())
    
    try:
        # Parse cursor data
        cursor_points = json.loads(cursor_data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid cursor_data JSON")
    
    # Save uploaded video to temp file
    input_path = TEMP_DIR / f"{job_id}_input.webm"
    output_path = TEMP_DIR / f"{job_id}_output.mp4"
    
    with open(input_path, "wb") as f:
        content = await video.read()
        f.write(content)
    
    # Initialize job status
    processing_jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "output_path": str(output_path),
        "error": None
    }
    
    # Process in background
    background_tasks.add_task(
        run_processing,
        job_id,
        str(input_path),
        str(output_path),
        cursor_points,
        cursor_style,
        cursor_size,
        cursor_color,
        smooth,
        quality
    )
    
    return {"job_id": job_id, "status": "processing"}


async def run_processing(
    job_id: str,
    input_path: str,
    output_path: str,
    cursor_points: list[dict],
    cursor_style: str,
    cursor_size: int,
    cursor_color: str,
    smooth: bool,
    quality: str
):
    """Background task for video processing."""
    try:
        def progress_callback(progress: float):
            processing_jobs[job_id]["progress"] = int(progress * 100)
        
        # Run CPU-intensive work in thread pool
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            process_video_with_cursor,
            input_path,
            output_path,
            cursor_points,
            cursor_style,
            cursor_size,
            cursor_color,
            smooth,
            quality,
            progress_callback
        )
        
        processing_jobs[job_id]["status"] = "completed"
        processing_jobs[job_id]["progress"] = 100
        
    except Exception as e:
        processing_jobs[job_id]["status"] = "failed"
        processing_jobs[job_id]["error"] = str(e)
    
    finally:
        # Cleanup input file
        try:
            os.remove(input_path)
        except:
            pass


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    """Get processing job status."""
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return processing_jobs[job_id]


@app.get("/api/download/{job_id}")
async def download_video(job_id: str):
    """Download processed video."""
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = processing_jobs[job_id]
    
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail=f"Job status: {job['status']}")
    
    output_path = Path(job["output_path"])
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found")
    
    return FileResponse(
        output_path,
        media_type="video/mp4",
        filename=f"cursor-flow-export-{job_id[:8]}.mp4"
    )


@app.delete("/api/cleanup/{job_id}")
async def cleanup_job(job_id: str):
    """Cleanup job files after download."""
    if job_id in processing_jobs:
        job = processing_jobs[job_id]
        try:
            output_path = Path(job["output_path"])
            if output_path.exists():
                os.remove(output_path)
        except:
            pass
        del processing_jobs[job_id]
    
    return {"status": "cleaned"}


@app.post("/api/detect")
async def detect_cursor(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...)
):
    """
    Detect cursor positions in a video without cursor data.
    Uses computer vision to track the cursor.
    """
    job_id = str(uuid.uuid4())
    
    # Save uploaded video
    input_path = TEMP_DIR / f"{job_id}_detect.webm"
    
    with open(input_path, "wb") as f:
        content = await video.read()
        f.write(content)
    
    processing_jobs[job_id] = {
        "status": "detecting",
        "progress": 0,
        "cursor_data": None,
        "error": None
    }
    
    background_tasks.add_task(
        run_detection,
        job_id,
        str(input_path)
    )
    
    return {"job_id": job_id, "status": "detecting"}


async def run_detection(job_id: str, input_path: str):
    """Background task for cursor detection."""
    try:
        def progress_callback(progress: float):
            processing_jobs[job_id]["progress"] = int(progress * 100)
        
        loop = asyncio.get_event_loop()
        cursor_data = await loop.run_in_executor(
            None,
            detect_cursor_positions,
            input_path,
            progress_callback
        )
        
        processing_jobs[job_id]["status"] = "completed"
        processing_jobs[job_id]["progress"] = 100
        processing_jobs[job_id]["cursor_data"] = cursor_data
        
    except Exception as e:
        processing_jobs[job_id]["status"] = "failed"
        processing_jobs[job_id]["error"] = str(e)
    
    finally:
        try:
            os.remove(input_path)
        except:
            pass


@app.get("/api/cursor-styles")
async def get_cursor_styles():
    """Get available cursor styles."""
    return {
        "styles": [
            {"id": "fancy", "name": "Modern Arrow", "description": "Clean arrow with shadow"},
            {"id": "macos", "name": "macOS", "description": "macOS-style pointer"},
            {"id": "circle", "name": "Circle", "description": "Filled circle"},
            {"id": "dot", "name": "Dot", "description": "Small dot"},
            {"id": "ring", "name": "Ring", "description": "Hollow circle"},
            {"id": "crosshair", "name": "Crosshair", "description": "Crosshair target"},
        ]
    }
