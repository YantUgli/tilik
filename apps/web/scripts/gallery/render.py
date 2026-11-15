"""Render 3 gambar galeri FIKTIF (T-26). Semua nama satuan dan nomor fiktif, bertanda SINTETIS.

Jalankan dari apps/web:
    uv run --no-project --with pillow python -I scripts/gallery/render.py

Keluaran: public/gallery/galeri-01.png, galeri-02.jpg (tanpa EXIF; ditanam oleh precompute.mjs),
galeri-03.png. Tanpa lambang/logo dan tanpa wajah.
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "gallery")
FONT = "C:/Windows/Fonts/arial.ttf"
BOLD = "C:/Windows/Fonts/arialbd.ttf"


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def centered(draw, y, text, f, fill, width):
    w = draw.textlength(text, font=f)
    draw.text(((width - w) / 2, y), text, font=f, fill=fill)


def galeri_01():
    """Dokumen dinas fiktif (Surat Telegram) di atas meja."""
    W, H = 1200, 1500
    img = Image.new("RGB", (W, H), (120, 84, 52))  # meja kayu
    d = ImageDraw.Draw(img)
    for y in range(0, H, 38):  # serat kayu sederhana
        d.line([(0, y), (W, y + 12)], fill=(108, 75, 46), width=3)
    px0, py0, px1, py1 = 110, 90, 1090, 1420
    d.rectangle([px0 + 14, py0 + 14, px1 + 14, py1 + 14], fill=(70, 48, 30))  # bayangan
    d.rectangle([px0, py0, px1, py1], fill=(250, 250, 246))

    ink = (25, 25, 25)
    x = px0 + 70
    y = py0 + 60
    for line in ["KOMANDO DAERAH CONTOH", "KOMANDO RESOR CONTOH", "BATALYON INFANTERI 999/CONTOH"]:
        d.text((x, y), line, font=font(30, bold=True), fill=ink)
        y += 44
    d.line([(x, y + 4), (x + 560, y + 4)], fill=ink, width=3)

    y += 70
    centered(d, y, "SURAT TELEGRAM", font(46, bold=True), ink, W)
    y += 64
    centered(d, y, "Nomor ST/1192/2026", font(34), ink, W)

    y += 90
    rows = [
        ("KLASIFIKASI", "RAHASIA"),
        ("DERAJAT", "KILAT"),
        ("DARI", "DANYON INFANTERI 999/CONTOH"),
        ("KEPADA", "PARA DANKI YONIF 999/CONTOH"),
        ("TEMBUSAN", "KASI OPS YONIF 999/CONTOH"),
    ]
    for k, v in rows:
        d.text((x, y), k, font=font(32, bold=True), fill=ink)
        d.text((x + 270, y), f": {v}", font=font(32), fill=ink)
        y += 56

    y += 40
    body = [
        "1. Dalam rangka latihan contoh, para Danki agar",
        "   menyiapkan personel dan perlengkapan.",
        "2. Laporan kesiapan dikirim paling lambat H-1.",
        "3. Demikian untuk dilaksanakan.",
    ]
    for line in body:
        d.text((x, y), line, font=font(30), fill=ink)
        y += 48

    red = (190, 30, 30)
    d.rectangle([px0 + 60, py1 - 150, px1 - 60, py1 - 70], outline=red, width=5)
    centered(d, py1 - 136, "SINTETIS - CONTOH FIKTIF", font(44, bold=True), red, W)
    img = img.quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    img.save(os.path.join(OUT, "galeri-01.png"), optimize=True)


def galeri_02():
    """Pemandangan sederhana: langit, laut, pulau, pohon."""
    W, H = 1200, 800
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    horizon = 470
    for y in range(horizon):  # langit gradasi
        t = y / horizon
        d.line([(0, y), (W, y)], fill=(int(120 + 110 * t), int(170 + 60 * t), int(235 - 10 * t)))
    for y in range(horizon, H):  # laut
        t = (y - horizon) / (H - horizon)
        d.line([(0, y), (W, y)], fill=(int(30 + 20 * t), int(110 + 30 * t), int(160 + 20 * t)))
    d.ellipse([880, 90, 990, 200], fill=(255, 236, 160))  # matahari
    d.polygon([(0, H), (0, 600), (260, 640), (520, 720), (620, H)], fill=(222, 200, 150))  # pantai
    for tx, ty in [(150, 600), (300, 640)]:  # pohon kelapa
        d.line([(tx, ty), (tx + 30, ty - 230)], fill=(110, 75, 40), width=16)
        top = (tx + 30, ty - 230)
        for dx, dy in [(-120, 40), (120, 40), (-90, -30), (90, -30), (0, -60)]:
            d.line([top, (top[0] + dx, top[1] + dy)], fill=(40, 130, 60), width=14)
    d.text((W - 230, H - 50), "SINTETIS", font=font(36, bold=True), fill=(255, 255, 255))
    img.save(os.path.join(OUT, "galeri-02.jpg"), quality=82, optimize=True)


def galeri_03():
    """Kartu ucapan ulang tahun (tanpa unsur dinas)."""
    W, H = 1200, 900
    img = Image.new("RGB", (W, H), (255, 244, 225))
    d = ImageDraw.Draw(img)
    d.rectangle([40, 40, W - 40, H - 40], outline=(230, 120, 140), width=10)
    colors = [(240, 100, 120), (100, 170, 240), (250, 200, 80), (120, 200, 140)]
    for i, (bx, by) in enumerate([(130, 160), (1000, 180), (180, 640), (1010, 650)]):  # balon
        d.ellipse([bx - 50, by - 65, bx + 50, by + 65], fill=colors[i % 4])
        d.line([(bx, by + 65), (bx + 10, by + 160)], fill=(120, 120, 120), width=3)
    ink = (120, 40, 80)
    centered(d, 300, "Selamat", font(110, bold=True), ink, W)
    centered(d, 430, "Ulang Tahun", font(110, bold=True), ink, W)
    centered(d, 590, "semoga sehat dan bahagia", font(48), (90, 70, 80), W)
    centered(d, 780, "SINTETIS - contoh fiktif", font(30), (150, 120, 130), W)
    img = img.quantize(colors=48, method=Image.Quantize.MEDIANCUT)
    img.save(os.path.join(OUT, "galeri-03.png"), optimize=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    galeri_01()
    galeri_02()
    galeri_03()
    for name in sorted(os.listdir(OUT)):
        print(name, os.path.getsize(os.path.join(OUT, name)), file=sys.stderr)
