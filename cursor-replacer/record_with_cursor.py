#!/usr/bin/env python3
"""
Screen recorder with mouse position logging.
Records video and saves mouse coordinates to a JSON file for precise cursor replacement.

Usage:
    python record_with_cursor.py -o recording.mp4
    
Press Ctrl+C or 'q' to stop recording.
"""

import cv2
import numpy as np
import json
import time
import argparse
import threading
from pathlib import Path

try:
    from pynput import mouse
    PYNPUT_AVAILABLE = True
except ImportError:
    PYNPUT_AVAILABLE = False

try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False

try:
    from mss import mss
    MSS_AVAILABLE = True
except ImportError:
    MSS_AVAILABLE = False


class MouseTracker:
    """Track mouse position in a separate thread."""
    
    def __init__(self):
        self.x = 0
        self.y = 0
        self.lock = threading.Lock()
        self.running = False
        
    def start(self):
        if PYNPUT_AVAILABLE:
            self.running = True
            self.listener = mouse.Listener(on_move=self._on_move)
            self.listener.start()
        elif PYAUTOGUI_AVAILABLE:
            self.running = True
            self.thread = threading.Thread(target=self._poll_position, daemon=True)
            self.thread.start()
    
    def _on_move(self, x, y):
        with self.lock:
            self.x = x
            self.y = y
    
    def _poll_position(self):
        while self.running:
            pos = pyautogui.position()
            with self.lock:
                self.x = pos.x
                self.y = pos.y
            time.sleep(0.001)  # 1ms polling
    
    def get_position(self):
        with self.lock:
            return (self.x, self.y)
    
    def stop(self):
        self.running = False
        if PYNPUT_AVAILABLE and hasattr(self, 'listener'):
            self.listener.stop()


def record_screen(output_path, fps=30, duration=None, hide_cursor=False):
    """
    Record screen with mouse position logging.
    
    Args:
        output_path: Output video file path
        fps: Frames per second
        duration: Recording duration in seconds (None for unlimited)
        hide_cursor: Whether to hide system cursor during recording
    """
    output_path = Path(output_path)
    cursor_log_path = output_path.with_suffix('.json')
    
    if not MSS_AVAILABLE:
        print("Error: mss library required. Install with: pip install mss")
        return
    
    if not PYNPUT_AVAILABLE and not PYAUTOGUI_AVAILABLE:
        print("Error: pynput or pyautogui required. Install with: pip install pynput")
        return
    
    # Initialize screen capture
    sct = mss()
    monitor = sct.monitors[1]  # Primary monitor
    
    width = monitor['width']
    height = monitor['height']
    
    print(f"Recording screen: {width}x{height} @ {fps}fps")
    print(f"Output: {output_path}")
    print(f"Cursor log: {cursor_log_path}")
    print("Press Ctrl+C to stop recording...")
    
    # Initialize mouse tracker
    tracker = MouseTracker()
    tracker.start()
    
    # Cursor positions log
    cursor_positions = []
    
    # Frame timing
    frame_duration = 1.0 / fps
    start_time = time.time()
    frame_count = 0
    
    # Temporary frames storage
    import tempfile
    import os
    temp_dir = tempfile.mkdtemp()
    
    try:
        while True:
            frame_start = time.time()
            
            # Check duration limit
            elapsed = frame_start - start_time
            if duration and elapsed >= duration:
                break
            
            # Capture screen
            img = sct.grab(monitor)
            frame = np.array(img)
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
            
            # Get mouse position
            mx, my = tracker.get_position()
            
            # Log cursor position with timestamp
            cursor_positions.append({
                'frame': frame_count,
                'time': elapsed,
                'x': mx,
                'y': my
            })
            
            # Save frame
            frame_path = os.path.join(temp_dir, f"frame_{frame_count:06d}.png")
            cv2.imwrite(frame_path, frame)
            
            frame_count += 1
            
            # Status update
            if frame_count % fps == 0:
                print(f"  Recording: {int(elapsed)}s, {frame_count} frames, cursor at ({mx}, {my})")
            
            # Maintain frame rate
            frame_elapsed = time.time() - frame_start
            if frame_elapsed < frame_duration:
                time.sleep(frame_duration - frame_elapsed)
                
    except KeyboardInterrupt:
        print("\nStopping recording...")
    
    finally:
        tracker.stop()
        
        # Save cursor positions
        print(f"Saving cursor log ({len(cursor_positions)} positions)...")
        with open(cursor_log_path, 'w') as f:
            json.dump({
                'fps': fps,
                'width': width,
                'height': height,
                'frames': frame_count,
                'positions': cursor_positions
            }, f, indent=2)
        
        # Encode video with ffmpeg
        print("Encoding video...")
        import subprocess
        
        out_width = width if width % 2 == 0 else width - 1
        out_height = height if height % 2 == 0 else height - 1
        
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
        
        # Cleanup
        print("Cleaning up...")
        for f in os.listdir(temp_dir):
            os.remove(os.path.join(temp_dir, f))
        os.rmdir(temp_dir)
        
        print(f"Done! Recorded {frame_count} frames ({frame_count/fps:.1f}s)")
        print(f"Video: {output_path}")
        print(f"Cursor log: {cursor_log_path}")


def main():
    parser = argparse.ArgumentParser(description="Record screen with mouse position logging")
    parser.add_argument("-o", "--output", default="recording.mp4", help="Output video file")
    parser.add_argument("--fps", type=int, default=30, help="Frames per second")
    parser.add_argument("--duration", type=int, help="Recording duration in seconds")
    
    args = parser.parse_args()
    
    record_screen(
        output_path=args.output,
        fps=args.fps,
        duration=args.duration
    )


if __name__ == "__main__":
    main()
