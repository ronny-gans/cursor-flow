#!/usr/bin/env python3
"""
Cursor Replacer - Tracks and replaces mouse cursor in videos with a custom overlay image.

Usage:
    python cursor_replacer.py --input video.mp4 --output output.mp4 --cursor cursor.png
    
Options:
    --input, -i     Input video file path
    --output, -o    Output video file path
    --cursor, -c    Cursor image to overlay (PNG with transparency recommended)
    --threshold     Detection threshold (0-255, default: 200)
    --size          Size of replacement cursor (default: 32)
    --offset-x      X offset for cursor placement (default: 0)
    --offset-y      Y offset for cursor placement (default: 0)
"""

import cv2
import numpy as np
import argparse
import subprocess
import tempfile
import os
from pathlib import Path


def create_cursor_templates():
    """
    Create templates for standard arrow cursor detection.
    Returns list of cursor templates at different scales.
    """
    templates = []
    
    # Standard arrow cursor shape (white with black border)
    for size in [16, 20, 24, 28, 32]:
        # White arrow cursor
        cursor = np.zeros((size, size), dtype=np.uint8)
        points = np.array([
            [0, 0],
            [0, int(size * 0.85)],
            [int(size * 0.25), int(size * 0.65)],
            [int(size * 0.55), int(size * 0.55)],
        ], dtype=np.int32)
        cv2.fillPoly(cursor, [points], 255)
        templates.append(cursor)
        
        # Also add inverted (black cursor on light background)
        templates.append(255 - cursor)
    
    return templates


def find_cursor_by_template(frame, templates, prev_position=None, search_radius=200):
    """
    Find cursor using template matching.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    best_match = None
    best_val = 0
    
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


def find_cursor_by_edge(frame, prev_position=None, search_radius=200):
    """
    Find cursor by detecting its characteristic edge pattern.
    """
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
            # Check aspect ratio
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


def find_cursor_by_motion(prev_frame, curr_frame, prev_position=None, search_radius=300):
    """
    Detect cursor by analyzing motion between frames.
    """
    if prev_frame is None:
        return None
    
    # Convert to grayscale
    gray1 = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(curr_frame, cv2.COLOR_BGR2GRAY)
    
    # Calculate absolute difference
    diff = cv2.absdiff(gray1, gray2)
    
    # Apply threshold
    _, thresh = cv2.threshold(diff, 15, 255, cv2.THRESH_BINARY)
    
    # Morphological operations
    kernel = np.ones((5, 5), np.uint8)
    thresh = cv2.dilate(thresh, kernel, iterations=2)
    thresh = cv2.erode(thresh, kernel, iterations=1)
    
    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return prev_position
    
    # Filter by size
    valid_contours = [c for c in contours if 30 < cv2.contourArea(c) < 10000]
    
    if not valid_contours:
        return prev_position
    
    # Find the motion closest to previous position
    if prev_position is not None:
        def distance_to_prev(contour):
            M = cv2.moments(contour)
            if M["m00"] > 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                return np.sqrt((cx - prev_position[0])**2 + (cy - prev_position[1])**2)
            return float('inf')
        
        # Only consider contours within search radius
        nearby = [c for c in valid_contours if distance_to_prev(c) < search_radius]
        
        if nearby:
            best_contour = min(nearby, key=distance_to_prev)
        else:
            # If no nearby motion, cursor might be stationary - keep previous position
            return prev_position
    else:
        best_contour = max(valid_contours, key=cv2.contourArea)
    
    M = cv2.moments(best_contour)
    if M["m00"] > 0:
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        return (cx, cy)
    
    return prev_position


def find_cursor_combined(frame, prev_frame, templates, prev_position, search_radius=300):
    """
    Combined cursor detection using multiple methods.
    """
    candidates = []
    
    # Method 1: Template matching
    pos1 = find_cursor_by_template(frame, templates, prev_position, search_radius)
    if pos1:
        candidates.append(('template', pos1))
    
    # Method 2: Motion detection
    pos2 = find_cursor_by_motion(prev_frame, frame, prev_position, search_radius)
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
        def dist(pos):
            return np.sqrt((pos[0] - prev_position[0])**2 + (pos[1] - prev_position[1])**2)
        
        # Prefer motion detection if cursor moved
        for method, pos in candidates:
            if method == 'motion':
                return pos
        
        # Otherwise use closest match
        return min(candidates, key=lambda x: dist(x[1]))[1]
    
    # No previous position - use first valid candidate
    return candidates[0][1]


def overlay_image(background, overlay, position, size=None):
    """
    Overlay an image with transparency onto a background.
    
    Args:
        background: Background frame
        overlay: Overlay image (with alpha channel)
        position: (x, y) position for overlay
        size: Optional (width, height) to resize overlay
    
    Returns:
        Combined image
    """
    if overlay is None:
        return background
    
    result = background.copy()
    x, y = position
    
    # Resize overlay if needed
    if size is not None:
        overlay = cv2.resize(overlay, size, interpolation=cv2.INTER_AREA)
    
    h, w = overlay.shape[:2]
    
    # Calculate bounds
    y1, y2 = max(0, y), min(background.shape[0], y + h)
    x1, x2 = max(0, x), min(background.shape[1], x + w)
    
    # Calculate overlay region
    oy1 = max(0, -y)
    ox1 = max(0, -x)
    oy2 = oy1 + (y2 - y1)
    ox2 = ox1 + (x2 - x1)
    
    if y2 <= y1 or x2 <= x1:
        return result
    
    # Handle alpha channel
    if overlay.shape[2] == 4:
        alpha = overlay[oy1:oy2, ox1:ox2, 3] / 255.0
        alpha = np.stack([alpha] * 3, axis=-1)
        
        overlay_rgb = overlay[oy1:oy2, ox1:ox2, :3]
        background_region = result[y1:y2, x1:x2]
        
        result[y1:y2, x1:x2] = (alpha * overlay_rgb + (1 - alpha) * background_region).astype(np.uint8)
    else:
        result[y1:y2, x1:x2] = overlay[oy1:oy2, ox1:ox2]
    
    return result


def mask_original_cursor(frame, position, mask_radius=20):
    """
    Mask the original cursor by inpainting the region.
    
    Args:
        frame: Video frame
        position: Cursor position
        mask_radius: Radius of mask
    
    Returns:
        Frame with cursor masked
    """
    if position is None:
        return frame
    
    result = frame.copy()
    x, y = position
    
    # Create mask
    mask = np.zeros(frame.shape[:2], dtype=np.uint8)
    cv2.circle(mask, (x, y), mask_radius, 255, -1)
    
    # Inpaint
    result = cv2.inpaint(result, mask, mask_radius, cv2.INPAINT_TELEA)
    
    return result


def create_default_cursor(size=32, color=(0, 255, 255)):
    """
    Create a default circle cursor image.
    
    Args:
        size: Size of cursor image
        color: BGR color tuple (default: yellow)
    
    Returns:
        Cursor image with alpha channel
    """
    cursor = np.zeros((size, size, 4), dtype=np.uint8)
    
    center = size // 2
    radius = size // 2 - 2
    
    # Draw filled circle
    cv2.circle(cursor, (center, center), radius, (*color, 255), -1)
    
    # Add border
    cv2.circle(cursor, (center, center), radius, (0, 0, 0, 255), 2)
    
    return cursor


def smooth_positions(positions, window_size=5):
    """
    Smooth cursor positions using moving average.
    
    Args:
        positions: List of (x, y) positions
        window_size: Smoothing window size
    
    Returns:
        Smoothed positions list
    """
    if len(positions) < window_size:
        return positions
    
    smoothed = []
    for i in range(len(positions)):
        start = max(0, i - window_size // 2)
        end = min(len(positions), i + window_size // 2 + 1)
        
        valid_positions = [p for p in positions[start:end] if p is not None]
        
        if valid_positions:
            avg_x = int(np.mean([p[0] for p in valid_positions]))
            avg_y = int(np.mean([p[1] for p in valid_positions]))
            smoothed.append((avg_x, avg_y))
        else:
            smoothed.append(positions[i])
    
    return smoothed


def process_video(input_path, output_path, cursor_image_path=None, 
                  threshold=200, cursor_size=32, offset_x=0, offset_y=0,
                  mask_original=True, smooth=True):
    """
    Process video to replace cursor.
    
    Args:
        input_path: Input video path
        output_path: Output video path
        cursor_image_path: Path to cursor image (PNG with alpha)
        threshold: Detection threshold
        cursor_size: Size of replacement cursor
        offset_x: X offset for cursor placement
        offset_y: Y offset for cursor placement
        mask_original: Whether to mask original cursor
        smooth: Whether to smooth cursor movement
    """
    # Open input video
    cap = cv2.VideoCapture(str(input_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {input_path}")
    
    # Get video properties
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Video: {width}x{height} @ {fps}fps, {total_frames} frames")
    
    # Load cursor image
    if cursor_image_path and Path(cursor_image_path).exists():
        cursor_img = cv2.imread(str(cursor_image_path), cv2.IMREAD_UNCHANGED)
        if cursor_img.shape[2] == 3:
            # Add alpha channel if missing
            alpha = np.ones((cursor_img.shape[0], cursor_img.shape[1]), dtype=np.uint8) * 255
            cursor_img = np.dstack([cursor_img, alpha])
        print(f"Loaded cursor image: {cursor_image_path}")
    else:
        cursor_img = create_default_cursor(cursor_size)
        print("Using default cursor")
    
    # Resize cursor
    cursor_img = cv2.resize(cursor_img, (cursor_size, cursor_size), interpolation=cv2.INTER_AREA)
    
    # Create cursor templates for detection
    templates = create_cursor_templates()
    
    # First pass: detect cursor positions
    print("Pass 1: Detecting cursor positions...")
    positions = []
    prev_frame = None
    prev_position = None
    
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Use combined detection method
        position = find_cursor_combined(frame, prev_frame, templates, prev_position, search_radius=400)
        
        positions.append(position)
        prev_position = position
        prev_frame = frame.copy()
        
        frame_count += 1
        if frame_count % 100 == 0:
            print(f"  Processed {frame_count}/{total_frames} frames")
    
    print(f"  Detected positions in {sum(1 for p in positions if p is not None)}/{len(positions)} frames")
    
    # Smooth positions
    if smooth:
        print("Smoothing cursor positions...")
        positions = smooth_positions(positions)
    
    # Second pass: render output video
    print("Pass 2: Rendering output video...")
    cap.release()
    cap = cv2.VideoCapture(str(input_path))
    
    # Create temp directory for frames
    temp_dir = tempfile.mkdtemp()
    print(f"  Using temp directory: {temp_dir}")
    
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        position = positions[frame_idx] if frame_idx < len(positions) else None
        
        if position is not None:
            # Mask original cursor
            if mask_original:
                frame = mask_original_cursor(frame, position, mask_radius=cursor_size // 2 + 5)
            
            # Overlay new cursor (centered on position)
            cursor_pos = (position[0] + offset_x - cursor_size // 2, position[1] + offset_y - cursor_size // 2)
            frame = overlay_image(frame, cursor_img, cursor_pos)
        
        # Save frame
        frame_path = os.path.join(temp_dir, f"frame_{frame_idx:06d}.png")
        cv2.imwrite(frame_path, frame)
        
        frame_idx += 1
        if frame_idx % 100 == 0:
            print(f"  Rendered {frame_idx}/{total_frames} frames")
    
    cap.release()
    
    # Ensure dimensions are even for H.264
    out_width = width if width % 2 == 0 else width - 1
    out_height = height if height % 2 == 0 else height - 1
    
    # Use ffmpeg to combine frames
    print("  Encoding video with ffmpeg...")
    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-framerate', str(fps),
        '-i', os.path.join(temp_dir, 'frame_%06d.png'),
        '-vf', f'scale={out_width}:{out_height}',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        str(output_path)
    ]
    
    subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
    
    # Cleanup temp files
    print("  Cleaning up temp files...")
    for f in os.listdir(temp_dir):
        os.remove(os.path.join(temp_dir, f))
    os.rmdir(temp_dir)
    
    print(f"Output saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Replace mouse cursor in video with custom overlay image",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python cursor_replacer.py -i input.mp4 -o output.mp4
    python cursor_replacer.py -i input.mp4 -o output.mp4 -c custom_cursor.png
    python cursor_replacer.py -i input.mp4 -o output.mp4 --size 48 --threshold 180
        """
    )
    
    parser.add_argument("-i", "--input", required=True, help="Input video file")
    parser.add_argument("-o", "--output", required=True, help="Output video file")
    parser.add_argument("-c", "--cursor", help="Cursor image file (PNG with transparency)")
    parser.add_argument("--threshold", type=int, default=200, help="Detection threshold (0-255)")
    parser.add_argument("--size", type=int, default=32, help="Cursor size in pixels")
    parser.add_argument("--offset-x", type=int, default=0, help="X offset for cursor")
    parser.add_argument("--offset-y", type=int, default=0, help="Y offset for cursor")
    parser.add_argument("--no-mask", action="store_true", help="Don't mask original cursor")
    parser.add_argument("--no-smooth", action="store_true", help="Don't smooth cursor movement")
    
    args = parser.parse_args()
    
    input_path = Path(args.input)
    output_path = Path(args.output)
    
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        return 1
    
    process_video(
        input_path=input_path,
        output_path=output_path,
        cursor_image_path=args.cursor,
        threshold=args.threshold,
        cursor_size=args.size,
        offset_x=args.offset_x,
        offset_y=args.offset_y,
        mask_original=not args.no_mask,
        smooth=not args.no_smooth
    )
    
    return 0


if __name__ == "__main__":
    exit(main())
