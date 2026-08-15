"""Normalises the downloaded crop photos into card-ready images.

The raw Wikipedia lead images vary wildly — portrait botanical shots, 6 MB
originals, odd aspect ratios. The onboarding cards need one consistent shape and
a small payload, so each image is centre-cropped to 16:10 and written as WebP.

Run after scripts/fetch-crop-images.mjs:
    ml/.venv/Scripts/python.exe scripts/crop-images.py
"""
import io
import json
import os

from PIL import Image, ImageOps

RAW = "public/images/crops/_raw"
OUT = "public/images/crops"
TARGET_W, TARGET_H = 800, 500  # 16:10, matches the card header in the reference

os.makedirs(OUT, exist_ok=True)
report = []

for name in sorted(os.listdir(RAW)):
    key = os.path.splitext(name)[0]
    src = os.path.join(RAW, name)
    try:
        img = Image.open(src)
        # Honour EXIF rotation before cropping, or some photos come out sideways.
        img = ImageOps.exif_transpose(img).convert("RGB")
        before_kb = os.path.getsize(src) / 1024

        # Centre-crop to the target aspect, then resize down.
        fitted = ImageOps.fit(
            img, (TARGET_W, TARGET_H), method=Image.LANCZOS, centering=(0.5, 0.5)
        )
        dest = os.path.join(OUT, f"{key}.webp")
        fitted.save(dest, "WEBP", quality=82, method=6)

        after_kb = os.path.getsize(dest) / 1024
        report.append((key, img.size, before_kb, after_kb))
        print(f"{key:<12} {img.size[0]}x{img.size[1]:<5} {before_kb:7.0f}KB -> {after_kb:6.0f}KB")
    except Exception as e:
        print(f"{key:<12} FAILED {type(e).__name__}: {e}")

total_before = sum(r[2] for r in report)
total_after = sum(r[3] for r in report)
print(f"\n{len(report)} images  {total_before/1024:.1f}MB -> {total_after/1024:.1f}MB")
