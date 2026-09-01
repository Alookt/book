"""
make_logo.py

Turns a regular image into a clean logo asset:
  1. Removes the background (AI-based, works on photos or complex backgrounds).
  2. Auto-crops to the actual subject (drops empty transparent margins).
  3. Adds even padding around the subject.
  4. Cleans up edge fringing/halo pixels left over from background removal.
  5. Exports a transparent PNG, plus optional resized icon versions.

Install:
    pip install rembg pillow numpy onnxruntime

Usage:
    python make_logo.py input.jpg
    python make_logo.py input.jpg --output logo.png --padding 40 --size 512
    python make_logo.py input.jpg --sizes 512 256 128 64   # also export favicon-style sizes
"""

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def remove_background(image: Image.Image) -> Image.Image:
    """AI background removal -> RGBA image with transparent background."""
    try:
        from rembg import remove
    except ImportError:
        sys.exit(
            "Missing dependency 'rembg'. Install with:\n"
            "    pip install rembg onnxruntime"
        )
    # rembg accepts PIL images directly and returns a PIL RGBA image
    result = remove(image)
    if result.mode != "RGBA":
        result = result.convert("RGBA")
    return result


def clean_edges(image: Image.Image, alpha_threshold: int = 20, feather: float = 1.2) -> Image.Image:
    """
    Removes semi-transparent 'halo' pixels left around the subject after
    background removal, then feathers the remaining edge slightly so it
    doesn't look jagged when placed on a new background/colour.
    """
    r, g, b, a = image.split()
    a_arr = np.array(a)

    # Hard-cut very faint alpha (leftover background fringe) to fully transparent
    a_arr = np.where(a_arr < alpha_threshold, 0, a_arr)
    a_clean = Image.fromarray(a_arr, mode="L")

    # Slight blur on the alpha channel only, to soften the cut edge
    a_soft = a_clean.filter(ImageFilter.GaussianBlur(radius=feather))

    return Image.merge("RGBA", (r, g, b, a_soft))


def autocrop_to_subject(image: Image.Image, alpha_threshold: int = 10) -> Image.Image:
    """Crops the transparent margins away, leaving only the subject's bounding box."""
    alpha = np.array(image.split()[-1])
    mask = alpha > alpha_threshold
    if not mask.any():
        return image  # nothing detected, return as-is rather than erroring

    ys, xs = np.where(mask)
    top, bottom = ys.min(), ys.max()
    left, right = xs.min(), xs.max()
    return image.crop((left, top, right + 1, bottom + 1))


def add_padding(image: Image.Image, padding: int) -> Image.Image:
    """Adds transparent padding evenly around the subject."""
    w, h = image.size
    canvas = Image.new("RGBA", (w + padding * 2, h + padding * 2), (0, 0, 0, 0))
    canvas.paste(image, (padding, padding), image)
    return canvas


def square_canvas(image: Image.Image) -> Image.Image:
    """
    Places the subject centred on a square transparent canvas, sized to the
    larger of width/height. Makes the result safe to drop into any square
    logo slot (app icons, avatars, favicons) without stretching.
    """
    w, h = image.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(image, ((side - w) // 2, (side - h) // 2), image)
    return canvas


def make_logo(
    input_path: str,
    output_path: str = "logo.png",
    padding: int = 30,
    square: bool = True,
    sizes: list[int] | None = None,
) -> None:
    src = Image.open(input_path).convert("RGB")

    print("Removing background...")
    no_bg = remove_background(src)

    print("Cleaning edges...")
    cleaned = clean_edges(no_bg)

    print("Cropping to subject...")
    cropped = autocrop_to_subject(cleaned)

    print("Adding padding...")
    padded = add_padding(cropped, padding)

    final = square_canvas(padded) if square else padded

    out_path = Path(output_path)
    final.save(out_path)
    print(f"Saved: {out_path.resolve()}  ({final.size[0]}x{final.size[1]})")

    if sizes:
        for s in sizes:
            resized = final.resize((s, s), Image.LANCZOS)
            sized_path = out_path.with_stem(f"{out_path.stem}_{s}")
            resized.save(sized_path)
            print(f"Saved: {sized_path.resolve()}  ({s}x{s})")


def main():
    parser = argparse.ArgumentParser(description="Turn an image into a clean, transparent logo PNG.")
    parser.add_argument("input", help="Path to the source image")
    parser.add_argument("--output", "-o", default="logo.png", help="Output PNG path (default: logo.png)")
    parser.add_argument("--padding", "-p", type=int, default=30, help="Padding in pixels around subject (default: 30)")
    parser.add_argument("--no-square", action="store_true", help="Keep original aspect ratio instead of centring on a square canvas")
    parser.add_argument("--sizes", nargs="*", type=int, default=None, help="Additional square sizes to export, e.g. --sizes 512 256 128 64")
    args = parser.parse_args()

    make_logo(
        input_path=args.input,
        output_path=args.output,
        padding=args.padding,
        square=not args.no_square,
        sizes=args.sizes,
    )


if __name__ == "__main__":
    main()