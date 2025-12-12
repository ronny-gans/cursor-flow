# Cursor Replacer

A Python tool that tracks and replaces the mouse cursor in videos with a custom overlay image.

## Features

- **Automatic cursor detection** using motion analysis and brightness detection
- **Custom cursor overlay** - use any PNG image with transparency
- **Original cursor masking** - removes the original cursor using inpainting
- **Smooth tracking** - applies position smoothing for natural movement
- **Configurable parameters** - adjust detection threshold, cursor size, and offsets

## Installation

```bash
cd cursor-replacer
pip install -r requirements.txt
```

## Usage

### Basic Usage

```bash
python cursor_replacer.py -i input_video.mp4 -o output_video.mp4
```

### With Custom Cursor Image

```bash
python cursor_replacer.py -i input.mp4 -o output.mp4 -c my_cursor.png
```

### All Options

```bash
python cursor_replacer.py \
    --input input.mp4 \
    --output output.mp4 \
    --cursor custom_cursor.png \
    --threshold 200 \
    --size 48 \
    --offset-x 0 \
    --offset-y 0 \
    --no-mask \
    --no-smooth
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--input` | `-i` | Input video file path | Required |
| `--output` | `-o` | Output video file path | Required |
| `--cursor` | `-c` | Custom cursor image (PNG with transparency) | Default arrow |
| `--threshold` | | Brightness threshold for detection (0-255) | 200 |
| `--size` | | Size of replacement cursor in pixels | 32 |
| `--offset-x` | | X offset for cursor placement | 0 |
| `--offset-y` | | Y offset for cursor placement | 0 |
| `--no-mask` | | Don't mask/remove original cursor | False |
| `--no-smooth` | | Don't smooth cursor movement | False |

## Tips

1. **Cursor Image**: Use a PNG with transparency for best results. The cursor hotspot is at the top-left corner.

2. **Detection Threshold**: Lower values detect more cursors but may have false positives. Higher values are more strict.

3. **Offset**: Use offset values to align the cursor hotspot correctly with your custom image.

4. **Video Quality**: Works best with high-quality screen recordings where the cursor is clearly visible.

## How It Works

1. **Pass 1 - Detection**: Analyzes each frame using:
   - Motion detection between consecutive frames
   - Brightness-based detection for static cursor
   - Position prediction based on previous frames

2. **Smoothing**: Applies moving average to cursor positions for natural movement

3. **Pass 2 - Rendering**: For each frame:
   - Masks original cursor using inpainting
   - Overlays custom cursor image at detected position

## Limitations

- Works best with standard arrow cursors on light/dark backgrounds
- May struggle with heavily stylized or animated cursors
- Detection accuracy depends on video quality and cursor visibility
