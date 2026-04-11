"""
Gem Sphere Processor — removes white backgrounds from raw gem PNGs.

Usage:
  python scripts/process_gems.py

Reads from:  assets/raw/tier*gem.png
Outputs to:  public/gems/spheres/gem_tier*.png  (transparent PNGs)
             assets/gems/spheres/gem_tier*.png  (archive copy)

The script detects white background via connected-component labeling
(any white-ish region touching image edges = background), then sets
those pixels to transparent. Sphere and gem contents stay intact.
"""

from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage
import os
import glob

# Paths relative to project root
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INPUT_DIR = os.path.join(PROJECT_ROOT, 'assets', 'raw')
OUTPUT_DIRS = [
    os.path.join(PROJECT_ROOT, 'assets', 'gems', 'spheres'),
    os.path.join(PROJECT_ROOT, 'public', 'gems', 'spheres'),
]

# Background detection threshold (0-255). Pixels with R,G,B all >= this
# value are candidates for background removal.
BG_THRESHOLD = 245

# Gaussian blur radius for anti-aliasing the alpha mask edges
EDGE_BLUR = 1.5


def remove_background(img_path: str, threshold: int = BG_THRESHOLD) -> Image.Image:
    """Remove white background from a gem sphere image.

    Uses scipy connected-component labeling to find all white-ish regions
    that touch the image edges (i.e. the background), then makes them
    transparent. Interior white (highlights, sparkles) is preserved.
    """
    img = Image.open(img_path).convert('RGBA')
    arr = np.array(img)
    h, w = arr.shape[:2]

    # Binary mask: True where all RGB channels >= threshold
    white_mask = np.all(arr[:, :, :3] >= threshold, axis=2)

    # Label connected components of white pixels
    labels, _ = ndimage.label(white_mask)

    # Find labels touching any image edge (those are background)
    edge_labels = set()
    edge_labels.update(labels[0, :].tolist())       # top
    edge_labels.update(labels[-1, :].tolist())      # bottom
    edge_labels.update(labels[:, 0].tolist())       # left
    edge_labels.update(labels[:, -1].tolist())      # right
    edge_labels.discard(0)  # 0 = no component

    # Background = union of all edge-touching white components
    bg_mask = np.isin(labels, list(edge_labels))

    # Alpha: 255 for sphere, 0 for background
    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)

    # Smooth alpha edges for clean anti-aliasing
    alpha_img = Image.fromarray(alpha)
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=EDGE_BLUR))
    alpha = np.array(alpha_img)

    arr[:, :, 3] = alpha
    return Image.fromarray(arr)


def process_all():
    """Find all .png files in INPUT_DIR and process them."""
    pattern = os.path.join(INPUT_DIR, '*.png')
    files = sorted(glob.glob(pattern))

    if not files:
        print(f'No .png files found in {INPUT_DIR}')
        return

    # Ensure output dirs exist
    for d in OUTPUT_DIRS:
        os.makedirs(d, exist_ok=True)

    for path in files:
        basename = os.path.basename(path)
        name_no_ext = os.path.splitext(basename)[0]

        # Output name: "tier3gem.png" → "gem_tier3.png", "pebble.png" → "gem_pebble.png"
        if name_no_ext.startswith('tier') and name_no_ext.endswith('gem'):
            tier_str = name_no_ext.replace('tier', '').replace('gem', '')
            out_name = f'gem_tier{tier_str}.png'
        else:
            out_name = f'gem_{name_no_ext}.png'

        print(f'Processing {basename}...')
        result = remove_background(path)

        # Crop to tight bounding box + padding
        bbox = result.getbbox()
        if bbox:
            pad = 8
            x0 = max(0, bbox[0] - pad)
            y0 = max(0, bbox[1] - pad)
            x1 = min(result.width, bbox[2] + pad)
            y1 = min(result.height, bbox[3] + pad)
            result = result.crop((x0, y0, x1, y1))

        for d in OUTPUT_DIRS:
            out_path = os.path.join(d, out_name)
            result.save(out_path, 'PNG')
            print(f'  -> {out_path} ({result.size[0]}x{result.size[1]})')

    print(f'\nDone! Processed {len(files)} file(s).')


if __name__ == '__main__':
    process_all()
