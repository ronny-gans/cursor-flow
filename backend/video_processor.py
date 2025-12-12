"""
Video Processing Module
Handles cursor overlay, detection, and encoding using OpenCV + ffmpeg
"""

import cv2
import numpy as np
import subprocess
import tempfile
import os
from pathlib import Path
from typing import Callable, Optional
from enum import Enum


class CursorStyle(Enum):
    FANCY = "fancy"
    MACOS = "macos"
    CIRCLE = "circle"
    DOT = "dot"
    RING = "ring"
    CROSSHAIR = "crosshair"


# --- Cursor Image Generators ---

def create_fancy_cursor(size: int = 48) -> np.ndarray:
    """Create a beautiful modern cursor with perfectly smooth edges."""
    # Very high scale for perfect antialiasing
    scale = 16
    large_size = size * scale
    
    # Create cursor with float precision for smooth blending
    cursor = np.zeros((large_size, large_size, 4), dtype=np.float32)
    
    # Simple clean arrow - just 3 points for smooth diagonal
    # Tip at top, left edge straight down, diagonal back to tip
    points = np.array([
        [large_size * 0.12, large_size * 0.02],   # Tip (top)
        [large_size * 0.12, large_size * 0.72],   # Bottom left
        [large_size * 0.52, large_size * 0.32],   # Right point (on diagonal)
    ], dtype=np.float32)
    
    points_int = points.astype(np.int32)
    
    # Draw soft shadow
    shadow_layer = np.zeros((large_size, large_size), dtype=np.float32)
    for i in range(8, 0, -1):
        offset = int(large_size * 0.005 * i)
        shadow_pts = (points + offset).astype(np.int32)
        temp = np.zeros((large_size, large_size), dtype=np.uint8)
        cv2.fillPoly(temp, [shadow_pts], 255)
        shadow_layer = np.maximum(shadow_layer, temp.astype(np.float32) * (0.06 - i * 0.006))
    
    # Blur shadow
    shadow_layer = cv2.GaussianBlur(shadow_layer, (31, 31), 0)
    cursor[:, :, 3] = np.maximum(cursor[:, :, 3], shadow_layer * 255)
    
    # Draw black outline on separate layer
    outline_layer = np.zeros((large_size, large_size), dtype=np.uint8)
    cv2.fillPoly(outline_layer, [points_int], 255)
    
    # Blur outline for antialiasing
    outline_aa = cv2.GaussianBlur(outline_layer.astype(np.float32), (9, 9), 0)
    
    # Apply black where outline exists
    mask = outline_aa > 0
    cursor[mask, 0] = 0
    cursor[mask, 1] = 0
    cursor[mask, 2] = 0
    cursor[:, :, 3] = np.maximum(cursor[:, :, 3], outline_aa)
    
    # White fill - inset from outline
    border = int(large_size * 0.025)
    inner_points = np.array([
        [large_size * 0.12 + border, large_size * 0.02 + border],
        [large_size * 0.12 + border, large_size * 0.66],
        [large_size * 0.46, large_size * 0.32],
    ], dtype=np.int32)
    
    white_layer = np.zeros((large_size, large_size), dtype=np.uint8)
    cv2.fillPoly(white_layer, [inner_points], 255)
    
    # Blur white for antialiasing
    white_aa = cv2.GaussianBlur(white_layer.astype(np.float32), (7, 7), 0)
    
    # Blend white over black
    white_mask = white_aa / 255.0
    cursor[:, :, 0] = cursor[:, :, 0] * (1 - white_mask) + 255 * white_mask
    cursor[:, :, 1] = cursor[:, :, 1] * (1 - white_mask) + 255 * white_mask
    cursor[:, :, 2] = cursor[:, :, 2] * (1 - white_mask) + 255 * white_mask
    
    # Convert to uint8
    cursor = np.clip(cursor, 0, 255).astype(np.uint8)
    
    # Scale down with high-quality interpolation
    cursor = cv2.resize(cursor, (size, size), interpolation=cv2.INTER_AREA)
    
    return cursor


def create_macos_cursor(size: int = 48) -> np.ndarray:
    """Create a macOS-style cursor."""
    scale = 4
    large_size = size * scale
    cursor = np.zeros((large_size, large_size, 4), dtype=np.uint8)
    
    points = np.array([
        [int(large_size * 0.12), 0],
        [int(large_size * 0.12), int(large_size * 0.72)],
        [int(large_size * 0.28), int(large_size * 0.56)],
        [int(large_size * 0.45), int(large_size * 0.82)],
        [int(large_size * 0.55), int(large_size * 0.77)],
        [int(large_size * 0.38), int(large_size * 0.52)],
        [int(large_size * 0.58), int(large_size * 0.52)],
    ], dtype=np.int32)
    
    # Shadow
    for i in range(3, 0, -1):
        shadow_points = points + i * 2
        alpha = 30 + i * 15
        cv2.fillPoly(cursor, [shadow_points], (0, 0, 0, alpha))
    
    # Black outline
    cv2.fillPoly(cursor, [points], (0, 0, 0, 255))
    cv2.polylines(cursor, [points], True, (0, 0, 0, 255), int(large_size * 0.04))
    
    # White fill
    inner = (points - [int(large_size * 0.12), 0]) * 0.85 + [int(large_size * 0.14), int(large_size * 0.02)]
    inner = inner.astype(np.int32)
    cv2.fillPoly(cursor, [inner], (255, 255, 255, 255))
    
    cursor = cv2.resize(cursor, (size, size), interpolation=cv2.INTER_AREA)
    return cursor


def create_circle_cursor(size: int = 32, color: tuple = (255, 255, 255)) -> np.ndarray:
    """Create a filled circle cursor."""
    cursor = np.zeros((size, size, 4), dtype=np.uint8)
    center = size // 2
    radius = size // 2 - 2
    
    cv2.circle(cursor, (center, center), radius, (*color, 255), -1)
    cv2.circle(cursor, (center, center), radius, (0, 0, 0, 255), 2)
    
    return cursor


def create_dot_cursor(size: int = 24, color: tuple = (255, 255, 255)) -> np.ndarray:
    """Create a small dot cursor."""
    cursor = np.zeros((size, size, 4), dtype=np.uint8)
    center = size // 2
    radius = size // 3
    
    cv2.circle(cursor, (center, center), radius, (*color, 255), -1)
    
    return cursor


def create_ring_cursor(size: int = 40, color: tuple = (255, 255, 255), thickness: int = 3) -> np.ndarray:
    """Create a ring (hollow circle) cursor."""
    cursor = np.zeros((size, size, 4), dtype=np.uint8)
    center = size // 2
    radius = size // 2 - thickness
    
    cv2.circle(cursor, (center, center), radius, (*color, 255), thickness)
    
    return cursor


def create_crosshair_cursor(size: int = 32, color: tuple = (255, 255, 255), thickness: int = 2) -> np.ndarray:
    """Create a crosshair cursor."""
    cursor = np.zeros((size, size, 4), dtype=np.uint8)
    center = size // 2
    
    cv2.line(cursor, (0, center), (size, center), (*color, 255), thickness)
    cv2.line(cursor, (center, 0), (center, size), (*color, 255), thickness)
    cv2.circle(cursor, (center, center), 3, (*color, 255), -1)
    
    return cursor


def get_cursor_image(style: str, size: int, color: tuple) -> np.ndarray:
    """Get cursor image by style name."""
    if style == "fancy":
        return create_fancy_cursor(size)
    elif style == "macos":
        return create_macos_cursor(size)
    elif style == "circle":
        return create_circle_cursor(size, color)
    elif style == "dot":
        return create_dot_cursor(size, color)
    elif style == "ring":
        return create_ring_cursor(size, color)
    elif style == "crosshair":
        return create_crosshair_cursor(size, color)
    else:
        return create_fancy_cursor(size)


def parse_color(color_name: str) -> tuple:
    """Parse color name to BGR tuple."""
    colors = {
        'red': (0, 0, 255),
        'green': (0, 255, 0),
        'blue': (255, 0, 0),
        'yellow': (0, 255, 255),
        'cyan': (255, 255, 0),
        'magenta': (255, 0, 255),
        'white': (255, 255, 255),
        'orange': (0, 165, 255),
    }
    return colors.get(color_name.lower(), (255, 255, 255))


# --- Position Smoothing ---

def smooth_positions(positions: list[dict], alpha: float = 0.35) -> list[dict]:
    """Smooth cursor positions using bidirectional EMA."""
    if len(positions) < 2:
        return positions
    
    # Forward pass
    smoothed = [positions[0].copy()]
    for i in range(1, len(positions)):
        prev = smoothed[-1]
        curr = positions[i]
        
        new_x = alpha * curr['x'] + (1 - alpha) * prev['x']
        new_y = alpha * curr['y'] + (1 - alpha) * prev['y']
        
        smoothed.append({
            'x': new_x,
            'y': new_y,
            'time': curr['time']
        })
    
    # Backward pass
    for i in range(len(smoothed) - 2, -1, -1):
        next_pos = smoothed[i + 1]
        curr = smoothed[i]
        
        curr['x'] = alpha * curr['x'] + (1 - alpha) * next_pos['x']
        curr['y'] = alpha * curr['y'] + (1 - alpha) * next_pos['y']
    
    return smoothed


# --- Cursor Overlay ---

def overlay_cursor(frame: np.ndarray, cursor_img: np.ndarray, x: int, y: int) -> np.ndarray:
    """Overlay cursor image on frame at position (x, y)."""
    h, w = cursor_img.shape[:2]
    
    # Cursor hotspot at top-left for arrow cursors
    y1, y2 = max(0, y), min(frame.shape[0], y + h)
    x1, x2 = max(0, x), min(frame.shape[1], x + w)
    
    oy1 = max(0, -y)
    ox1 = max(0, -x)
    oy2 = oy1 + (y2 - y1)
    ox2 = ox1 + (x2 - x1)
    
    if y2 <= y1 or x2 <= x1:
        return frame
    
    result = frame.copy()
    
    if cursor_img.shape[2] == 4:
        alpha = cursor_img[oy1:oy2, ox1:ox2, 3] / 255.0
        alpha = np.stack([alpha] * 3, axis=-1)
        
        cursor_rgb = cursor_img[oy1:oy2, ox1:ox2, :3]
        background = result[y1:y2, x1:x2]
        
        result[y1:y2, x1:x2] = (alpha * cursor_rgb + (1 - alpha) * background).astype(np.uint8)
    
    return result


# --- Main Processing Functions ---

def process_video_with_cursor(
    input_path: str,
    output_path: str,
    cursor_points: list[dict],
    cursor_style: str = "fancy",
    cursor_size: int = 48,
    cursor_color: str = "white",
    smooth: bool = True,
    quality: str = "high",
    progress_callback: Optional[Callable[[float], None]] = None
):
    """
    Process video with cursor overlay.
    
    Args:
        input_path: Input video file
        output_path: Output MP4 file
        cursor_points: List of {x, y, time} dicts (normalized 0-1)
        cursor_style: Cursor style name
        cursor_size: Cursor size in pixels
        cursor_color: Cursor color name
        smooth: Whether to smooth positions
        quality: Encoding quality (high, balanced, fast)
        progress_callback: Optional callback for progress updates
    """
    # Open video
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {input_path}")
    
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Smooth positions if requested
    if smooth and len(cursor_points) > 1:
        cursor_points = smooth_positions(cursor_points)
    
    # Create cursor image
    color = parse_color(cursor_color)
    cursor_img = get_cursor_image(cursor_style, cursor_size, color)
    
    # Create position lookup by time
    def get_position_at_time(t: float) -> tuple[int, int]:
        """Interpolate cursor position at time t."""
        if not cursor_points:
            return (width // 2, height // 2)
        
        # Find surrounding points
        prev_point = cursor_points[0]
        next_point = cursor_points[-1]
        
        for i, point in enumerate(cursor_points):
            if point['time'] > t:
                next_point = point
                if i > 0:
                    prev_point = cursor_points[i - 1]
                break
            prev_point = point
        
        # Interpolate
        if prev_point['time'] == next_point['time']:
            x = prev_point['x'] * width
            y = prev_point['y'] * height
        else:
            ratio = (t - prev_point['time']) / (next_point['time'] - prev_point['time'])
            ratio = max(0, min(1, ratio))
            x = (prev_point['x'] + ratio * (next_point['x'] - prev_point['x'])) * width
            y = (prev_point['y'] + ratio * (next_point['y'] - prev_point['y'])) * height
        
        return (int(x), int(y))
    
    # Process frames to temp directory
    temp_dir = tempfile.mkdtemp()
    
    try:
        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Calculate time
            t = frame_idx / fps
            
            # Get cursor position
            x, y = get_position_at_time(t)
            
            # Overlay cursor
            frame = overlay_cursor(frame, cursor_img, x, y)
            
            # Save frame
            frame_path = os.path.join(temp_dir, f"frame_{frame_idx:06d}.png")
            cv2.imwrite(frame_path, frame)
            
            frame_idx += 1
            
            if progress_callback and frame_idx % 10 == 0:
                progress_callback(frame_idx / total_frames * 0.8)  # 80% for frame processing
        
        cap.release()
        
        # Encode with ffmpeg
        out_width = width if width % 2 == 0 else width - 1
        out_height = height if height % 2 == 0 else height - 1
        
        # Quality presets
        if quality == "high":
            crf = "18"
            preset = "slow"
        elif quality == "balanced":
            crf = "23"
            preset = "medium"
        else:
            crf = "28"
            preset = "fast"
        
        ffmpeg_cmd = [
            'ffmpeg', '-y',
            '-framerate', str(fps),
            '-i', os.path.join(temp_dir, 'frame_%06d.png'),
            '-vf', f'scale={out_width}:{out_height}',
            '-c:v', 'libx264',
            '-preset', preset,
            '-crf', crf,
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            output_path
        ]
        
        subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
        
        if progress_callback:
            progress_callback(1.0)
        
    finally:
        # Cleanup temp files
        for f in os.listdir(temp_dir):
            try:
                os.remove(os.path.join(temp_dir, f))
            except:
                pass
        try:
            os.rmdir(temp_dir)
        except:
            pass


# --- Cursor Detection (for videos without cursor data) ---

def create_cursor_templates() -> list[np.ndarray]:
    """Create templates for cursor detection at various scales."""
    templates = []
    
    for size in [16, 20, 24, 28, 32]:
        cursor = np.zeros((size, size), dtype=np.uint8)
        points = np.array([
            [0, 0],
            [0, int(size * 0.85)],
            [int(size * 0.25), int(size * 0.65)],
            [int(size * 0.55), int(size * 0.55)],
        ], dtype=np.int32)
        cv2.fillPoly(cursor, [points], 255)
        templates.append(cursor)
        templates.append(255 - cursor)  # Inverted for dark backgrounds
    
    return templates


def find_cursor_by_template(
    frame: np.ndarray, 
    templates: list[np.ndarray], 
    prev_position: tuple = None, 
    search_radius: int = 200
) -> tuple:
    """Find cursor using template matching."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    best_match = None
    best_val = 0
    
    # Define search region around previous position
    if prev_position is not None:
        x, y = prev_position
        h, w = gray.shape
        x1 = max(0, x - search_radius)
        y1 = max(0, y - search_radius)
        x2 = min(w, x + search_radius)
        y2 = min(h, y + search_radius)
        search_region = gray[y1:y2, x1:x2]
        offset = (x1, y1)
    else:
        search_region = gray
        offset = (0, 0)
    
    for template in templates:
        if template.shape[0] > search_region.shape[0] or template.shape[1] > search_region.shape[1]:
            continue
            
        result = cv2.matchTemplate(search_region, template, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(result)
        
        if max_val > best_val and max_val > 0.5:
            best_val = max_val
            th, tw = template.shape
            best_match = (max_loc[0] + tw // 2 + offset[0], max_loc[1] + th // 2 + offset[1])
    
    return best_match if best_match else prev_position


def find_cursor_by_edge(
    frame: np.ndarray, 
    prev_position: tuple = None, 
    search_radius: int = 200
) -> tuple:
    """Find cursor by detecting its characteristic edge pattern."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Define search region
    if prev_position is not None:
        x, y = prev_position
        h, w = gray.shape
        x1 = max(0, x - search_radius)
        y1 = max(0, y - search_radius)
        x2 = min(w, x + search_radius)
        y2 = min(h, y + search_radius)
        search_region = gray[y1:y2, x1:x2]
        offset = (x1, y1)
    else:
        search_region = gray
        offset = (0, 0)
    
    # Edge detection
    edges = cv2.Canny(search_region, 50, 150)
    
    # Dilate edges
    kernel = np.ones((3, 3), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)
    
    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return prev_position
    
    # Filter by size and shape (cursor is small and roughly triangular)
    valid_contours = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if 50 < area < 3000:
            x, y, w, h = cv2.boundingRect(contour)
            aspect = max(w, h) / (min(w, h) + 1)
            if 0.5 < aspect < 3:
                valid_contours.append(contour)
    
    if not valid_contours:
        return prev_position
    
    # Find best candidate
    if prev_position is not None:
        def distance_to_prev(contour):
            M = cv2.moments(contour)
            if M["m00"] > 0:
                cx = int(M["m10"] / M["m00"]) + offset[0]
                cy = int(M["m01"] / M["m00"]) + offset[1]
                return np.sqrt((cx - prev_position[0])**2 + (cy - prev_position[1])**2)
            return float('inf')
        
        best_contour = min(valid_contours, key=distance_to_prev)
    else:
        best_contour = max(valid_contours, key=cv2.contourArea)
    
    M = cv2.moments(best_contour)
    if M["m00"] > 0:
        cx = int(M["m10"] / M["m00"]) + offset[0]
        cy = int(M["m01"] / M["m00"]) + offset[1]
        return (cx, cy)
    
    return prev_position


def find_cursor_by_motion(prev_frame: np.ndarray, curr_frame: np.ndarray, prev_position: tuple = None) -> tuple:
    """Detect cursor by motion analysis."""
    if prev_frame is None:
        return None
    
    gray1 = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(curr_frame, cv2.COLOR_BGR2GRAY)
    
    diff = cv2.absdiff(gray1, gray2)
    _, thresh = cv2.threshold(diff, 15, 255, cv2.THRESH_BINARY)
    
    kernel = np.ones((5, 5), np.uint8)
    thresh = cv2.dilate(thresh, kernel, iterations=2)
    thresh = cv2.erode(thresh, kernel, iterations=1)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return prev_position
    
    valid_contours = [c for c in contours if 30 < cv2.contourArea(c) < 10000]
    
    if not valid_contours:
        return prev_position
    
    if prev_position is not None:
        def distance_to_prev(contour):
            M = cv2.moments(contour)
            if M["m00"] > 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                return np.sqrt((cx - prev_position[0])**2 + (cy - prev_position[1])**2)
            return float('inf')
        
        nearby = [c for c in valid_contours if distance_to_prev(c) < 300]
        
        if nearby:
            best_contour = min(nearby, key=distance_to_prev)
        else:
            return prev_position
    else:
        best_contour = max(valid_contours, key=cv2.contourArea)
    
    M = cv2.moments(best_contour)
    if M["m00"] > 0:
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        return (cx, cy)
    
    return prev_position


def find_cursor_combined(
    frame: np.ndarray,
    prev_frame: np.ndarray,
    templates: list[np.ndarray],
    prev_position: tuple,
    search_radius: int = 300
) -> tuple:
    """Combined cursor detection using multiple methods for better accuracy."""
    candidates = []
    
    # Method 1: Template matching
    pos1 = find_cursor_by_template(frame, templates, prev_position, search_radius)
    if pos1:
        candidates.append(('template', pos1))
    
    # Method 2: Motion detection
    pos2 = find_cursor_by_motion(prev_frame, frame, prev_position)
    if pos2 and pos2 != prev_position:
        candidates.append(('motion', pos2))
    
    # Method 3: Edge detection
    pos3 = find_cursor_by_edge(frame, prev_position, search_radius)
    if pos3:
        candidates.append(('edge', pos3))
    
    if not candidates:
        return prev_position
    
    # If we have previous position, prefer candidate closest to it
    if prev_position is not None:
        def distance(pos):
            return np.sqrt((pos[0] - prev_position[0])**2 + (pos[1] - prev_position[1])**2)
        
        # Filter out candidates too far from previous position
        nearby = [(method, pos) for method, pos in candidates if distance(pos) < search_radius]
        
        if nearby:
            # Prefer template match if available, otherwise closest
            template_matches = [p for m, p in nearby if m == 'template']
            if template_matches:
                return template_matches[0]
            return min(nearby, key=lambda x: distance(x[1]))[1]
    
    # No previous position - prefer template match
    template_matches = [p for m, p in candidates if m == 'template']
    if template_matches:
        return template_matches[0]
    
    return candidates[0][1]


def detect_cursor_positions(
    input_path: str,
    progress_callback: Optional[Callable[[float], None]] = None
) -> list[dict]:
    """
    Detect cursor positions in a video using combined computer vision methods.
    Uses template matching, motion detection, and edge detection for robust tracking.
    Returns list of {x, y, time} dicts (normalized 0-1).
    """
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {input_path}")
    
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Create detection templates
    templates = create_cursor_templates()
    
    positions = []
    prev_frame = None
    prev_position = None
    
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Use combined detection for better accuracy
        position = find_cursor_combined(frame, prev_frame, templates, prev_position)
        
        if position:
            positions.append({
                'x': position[0] / width,
                'y': position[1] / height,
                'time': frame_idx / fps
            })
            prev_position = position
        
        prev_frame = frame.copy()
        frame_idx += 1
        
        if progress_callback and frame_idx % 10 == 0:
            progress_callback(frame_idx / total_frames)
    
    cap.release()
    
    # Smooth detected positions
    if len(positions) > 1:
        positions = smooth_positions(positions, alpha=0.5)
    
    return positions
