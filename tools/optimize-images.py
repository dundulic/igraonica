#!/usr/bin/env python3
"""
Pravi WebP verzije fotografija u više širina (480, 800, 1200 px) za brže učitavanje.

Upotreba:
    python3 tools/optimize-images.py            # obrađuje sve .jpg u img/foto/
    python3 tools/optimize-images.py ime.jpg    # samo jednu sliku

Pravila za nove slike:
  * ime fajla opisno, malim slovima, bez č/ć/š/ž/đ, reči odvojene crticom
    (npr. beli-dvorac-na-naduvavanje-u-dvoristu.jpg)
  * originalni .jpg ostaje kao rezervna verzija (fallback) za stare pregledače
  * u HTML-u koristi <picture> sa srcset="...-480.webp 480w, ...-800.webp 800w, ...-1200.webp 1200w"
Potrebno: pip install pillow
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
FOTO = ROOT / "img" / "foto"
WIDTHS = (480, 800, 1200)
MAX_JPG = 1400


def process(src: Path) -> None:
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    # rezervni JPG: najviše 1400 px, bez EXIF podataka
    if max(im.size) > MAX_JPG:
        im.thumbnail((MAX_JPG, MAX_JPG), Image.LANCZOS)
    im.save(src, "JPEG", quality=78, optimize=True, progressive=True)
    for w in WIDTHS:
        out = src.with_name(f"{src.stem}-{w}.webp")
        v = im.copy()
        if v.width > w:
            v = v.resize((w, round(v.height * w / v.width)), Image.LANCZOS)
        v.save(out, "WEBP", quality=72, method=6)
    print(f"{src.name}: {im.size[0]}x{im.size[1]}")


if __name__ == "__main__":
    files = [FOTO / a for a in sys.argv[1:]] or sorted(FOTO.glob("*.jpg"))
    for f in files:
        process(f)
