"""Pembangun isi dokumen sintetis per template.

Setiap template menghasilkan `Content`: nama tata letak (file Jinja2 + CSS), konteks
template, dan meta label (eval-plan §3.1/§3.3). Baris teks dikirim ke template sebagai
dict kecil:

    {"t": teks, "role": peran, "el": elemen doc_elements | None, "s": sensitif?}

`el` dipakai untuk memeriksa konsistensi `doc_elements`; `s` menentukan `redact_boxes`.
Semua keacakan berasal dari satu `random.Random` per item, sehingga hasil deterministik.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

FIKTIF_PATH = Path(__file__).with_name("fiktif.yaml")

POSITIVE_TEMPLATES = ("st-a", "st-b", "st-c", "sb-a", "sb-b", "kop-only")
HARD_NEGATIVE_TEMPLATES = (
    "hn-civil-a",
    "hn-civil-b",
    "hn-rt",
    "hn-sekolah",
    "hn-undangan",
    "hn-struk",
    "hn-menu",
    "hn-jebakan",
)
ALL_TEMPLATES = POSITIVE_TEMPLATES + HARD_NEGATIVE_TEMPLATES

# Font bebas lisensi (keluarga Liberation dan DejaVu), dipilih per item.
FONTS = {
    "serif": ("Liberation Serif", "DejaVu Serif"),
    "sans": ("Liberation Sans", "DejaVu Sans"),
    "mono": ("Liberation Mono", "DejaVu Sans Mono"),
}
ROMAWI = ("I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII")
YEAR = 2026


@dataclass
class Content:
    template_id: str
    layout: str
    ctx: dict[str, Any]
    meta: dict[str, Any] = field(default_factory=dict)


@lru_cache(maxsize=1)
def fiktif() -> dict[str, Any]:
    return yaml.safe_load(FIKTIF_PATH.read_text(encoding="utf-8"))


def item_rng(template_id: str, index: int, seed: int) -> random.Random:
    # random.seed(str) memakai SHA-512, tidak dipengaruhi PYTHONHASHSEED.
    return random.Random(f"tilik-synthetic:{seed}:{template_id}:{index}")


# --------------------------------------------------------------------------- baris
def L(t: str, role: str = "body", el: str | None = None, s: bool = False) -> dict:
    return {"t": t, "role": role, "el": el, "s": s}


def R(k: str, v: str, role: str = "field", el: str | None = None, s: bool = False) -> dict:
    """Baris label : nilai. `k` kosong = baris lanjutan (rata dengan kolom nilai)."""
    return {"k": k, "v": v, "role": role, "el": el, "s": s}


def P(t: str, prefix: str | None = None, role: str = "body", el: str | None = None, s: bool = False) -> dict:
    """Paragraf; dipecah per baris di browser (lihat skrip di base.html.j2)."""
    return {"t": t, "prefix": prefix, "role": role, "el": el, "s": s}


def C(*cols: str, role: str = "body") -> dict:
    """Baris berkolom (mis. nama barang + harga)."""
    return {"cols": list(cols), "role": role, "el": None, "s": False}


# --------------------------------------------------------------------------- utilitas
def _style(rng: random.Random, kind: str, fs: tuple[int, int] = (22, 26)) -> dict:
    return {
        "font": rng.choice(FONTS[kind]),
        "fs": rng.randint(*fs),
        "mx": rng.randint(100, 150),
        "mt": rng.randint(80, 120),
        "wm_opacity": round(rng.uniform(0.10, 0.20), 2),
        "wm_angle": rng.randint(-45, -30),
        "wm_size": rng.randint(200, 250),
    }


def _date(rng: random.Random, upper: bool = False) -> str:
    s = f"{rng.randint(1, 28)} {rng.choice(fiktif()['bulan'])} {YEAR}"
    return s.upper() if upper else s


def _rupiah(n: int) -> str:
    return f"{n:,}".replace(",", ".")


_ROMAN_RE = re.compile(r"^[IVXL]+$")
_KEEP_UPPER = {"NRP", "NIP", "INF", "CZI", "ARM", "KAV", "CHB", "CKM"}


def tc(s: str) -> str:
    """Huruf judul untuk nama satuan; angka romawi dan singkatan pangkat tetap kapital."""

    def word(w: str) -> str:
        if _ROMAN_RE.match(w) or w in _KEEP_UPPER or any(ch.isdigit() for ch in w):
            return w
        return w[:1].upper() + w[1:].lower()

    return re.sub(r"[A-Za-z0-9.-]+", lambda m: word(m.group(0)), s)


def _sentence_case(s: str) -> str:
    return s[:1].upper() + s[1:]


_ABBR = {
    "SEHUBUNGAN": "SEHUB",
    "DENGAN": "DGN",
    "KEPADA": "KPD",
    "UNTUK": "UTK",
    "TERSEBUT": "TSB",
    "YANG": "YG",
    "TANGGAL": "TGL",
    "TENTANG": "TTG",
    "PERSONEL": "PERS",
    "DILAPORKAN": "DILAPKAN",
}


def telegram_style(s: str) -> str:
    """Gaya telegram: kapital, singkatan, koma → KMA, titik akhir kalimat → TTK."""
    s = s.upper()
    s = re.sub(r",(?=\s|$)", " KMA", s)
    s = re.sub(r"\.(?=\s|$)", " TTK", s)
    for full, abbr in _ABBR.items():
        s = re.sub(rf"\b{full}\b", abbr, s)
    return s


# --------------------------------------------------------------------------- satuan fiktif
def _person(rng: random.Random) -> tuple[str, str]:
    d = fiktif()["pejabat"]
    nama = f"{rng.choice(d['nama_depan'])} {rng.choice(d['nama_belakang'])}"
    pangkat = f"{rng.choice(d['pangkat_perwira'])} {rng.choice(d['korps'])} NRP 99{rng.randint(100000, 999999)}"
    return nama, pangkat


def _unit(rng: random.Random, max_lines: int = 3, exact_lines: int | None = None) -> dict:
    """Satuan fiktif penerbit + kop berjenjang (2–3 baris)."""
    d = fiktif()["satuan"]
    suf = lambda: rng.choice(d["akhiran"])  # noqa: E731
    kodam_no = f"{rng.choice(d['kodam_romawi'])}/{suf()}"
    korem_no = f"{rng.choice(d['korem_nomor'])}/{suf()}"
    kodim_n = rng.choice(d["kodim_nomor"])
    kodim_suf = suf()
    kodim_no = f"{kodim_n}/{kodim_suf}"
    yon_korps = rng.choice(d["korps_yonif"])
    yon_abbr = {
        "INFANTERI": "YONIF",
        "INFANTERI MEKANIS": "YONIF MEKANIS",
        "ZENI TEMPUR": "YONZIPUR",
        "ARTILERI MEDAN": "YONARMED",
    }[yon_korps]
    yon_no = f"{rng.choice(d['yonif_nomor'])}/{suf()}"

    kodam = f"KOMANDO DAERAH MILITER {kodam_no}"
    korem = f"KOMANDO RESOR MILITER {korem_no}"
    kodim = f"KOMANDO DISTRIK MILITER {kodim_no}"
    yonif = f"BATALYON {yon_korps} {yon_no}"

    ramil = sorted(rng.sample(range(1, 10), 4))
    units = {
        "kodim": {
            "nama": f"KODIM {kodim_no}",
            "full": f"KOMANDAN KODIM {kodim_no}",
            "dan": f"DANDIM {kodim_no}",
            "staf_jab": "KEPALA STAF",
            "staf": f"KASDIM {kodim_no}",
            "bawahan": [f"DANRAMIL {kodim_n}-{n:02d}/{kodim_suf}" for n in ramil],
            "atasan": f"DANREM {korem_no}",
        },
        "korem": {
            "nama": f"KOREM {korem_no}",
            "full": f"KOMANDAN KOREM {korem_no}",
            "dan": f"DANREM {korem_no}",
            "staf_jab": "KEPALA STAF",
            "staf": f"KASREM {korem_no}",
            "bawahan": [f"DANDIM {n}/{suf()}" for n in rng.sample(d["kodim_nomor"], 4)],
            "atasan": f"PANGDAM {kodam_no}",
        },
        "yonif": {
            "nama": f"{yon_abbr} {yon_no}",
            "full": f"KOMANDAN {yon_abbr} {yon_no}",
            "dan": f"DAN{yon_abbr.split()[0]} {yon_no}",
            "staf_jab": "WAKIL KOMANDAN",
            "staf": f"WADAN{yon_abbr.split()[0]} {yon_no}",
            "bawahan": [f"DANKI {k} {yon_abbr} {yon_no}" for k in "ABCD"],
            "atasan": f"PANGDAM {kodam_no}",
        },
    }
    chains = [([kodam, korem, kodim], "kodim"), ([korem, kodim], "kodim"), ([kodam, korem], "korem"), ([kodam, yonif], "yonif")]
    if exact_lines:
        chains = [c for c in chains if len(c[0]) == exact_lines]
    chains = [c for c in chains if len(c[0]) <= max_lines]
    kop, level = rng.choice(chains)
    u = dict(units[level])
    u["kop"] = kop
    u["kota"] = rng.choice(fiktif()["kota"])
    return u


def _kop_lines(u: dict) -> list[dict]:
    return [L(t, role="kop", el="kop_satuan", s=True) for t in u["kop"]]


def _logo() -> dict:
    return L("LOGO", role="logo")


def _listing(label: str, values: list[str], el: str | None, s: bool, numbered: bool = True) -> list[dict]:
    if len(values) == 1 or not numbered:
        return [R(label, values[0], el=el, s=s)] + [R("", v, el=el, s=s) for v in values[1:]]
    return [R(label if i == 0 else "", f"{i + 1}. {v}", el=el, s=s) for i, v in enumerate(values)]


def _kegiatan(rng: random.Random) -> dict:
    keg = fiktif()["kegiatan"]
    return rng.choice(keg[rng.choice(sorted(keg))])


# --------------------------------------------------------------------------- Surat Telegram
def _st(template_id: str, rng: random.Random) -> Content:
    d = fiktif()
    variant = template_id[-1]
    style = _style(rng, {"a": "serif", "b": "mono", "c": "sans"}[variant], (21, 25))
    u = _unit(rng)
    kls = rng.choices(["BIASA", "TERBATAS", "RAHASIA", "SANGAT RAHASIA"], weights=[3, 3, 3, 1])[0]
    drj = rng.choice(["BIASA", "SEGERA", "SANGAT SEGERA", "KILAT"])
    nomor = f"{rng.choices(['ST', 'TR'], weights=[4, 1])[0]}/{rng.randint(1, 2999)}/{YEAR}"
    keg = _kegiatan(rng)
    n_isi = rng.randint(2, 3)
    ref = (
        f"Sehubungan dengan surat {tc(u['atasan'])} nomor B/{rng.randint(10, 999)}/{rng.choice(ROMAWI)}/{YEAR} "
        f"tanggal {_date(rng)} tentang {keg['judul']}."
    )
    isi_src = [ref, *keg["kalimat"][:n_isi], rng.choice(d["penutup_st"])]
    conv = telegram_style if variant in "bc" else str.upper
    isi = [P(conv(s), prefix=f"{i + 1}.") for i, s in enumerate(isi_src)]

    kls_el = "klasifikasi" if kls != "BIASA" else None
    drj_el = "derajat" if drj != "BIASA" else None
    rahasia = kls in ("RAHASIA", "SANGAT RAHASIA")
    kepada = rng.sample(u["bawahan"], rng.randint(1, 3))
    tembusan = [u["atasan"], *rng.sample([u["staf"], "ARSIP"], 1)]
    nama, pangkat = _person(rng)

    ctx = {
        **style,
        "cls_pos": rng.choice(["left", "right"]),
        "logo": _logo(),
        "kop": _kop_lines(u),
        "title": L("SURAT TELEGRAM", role="title", el="surat_telegram", s=True),
        "kls": R("KLASIFIKASI", kls, el=kls_el, s=bool(kls_el)),
        "drj": R("DERAJAT", drj, el=drj_el, s=bool(drj_el)),
        "nomor": R("NOMOR", nomor, el="surat_telegram", s=True),
        "alamat": [
            R("DARI", u["dan"], el="blok_alamat", s=True),
            *_listing("KEPADA", kepada, "blok_alamat", True),
            *_listing("TEMBUSAN", tembusan, "blok_alamat", True),
        ],
        "isi": isi,
        "tempat": [R("DIKELUARKAN DI", u["kota"], role="ttd"), R("PADA TANGGAL", _date(rng, upper=True), role="ttd")],
        "ttd": [L(f"A.N. {u['full']}", role="ttd"), L(f"{u['staf_jab']},", role="ttd")],
        "ttd_nama": [L(nama, role="ttd"), L(pangkat, role="ttd")],
        "stamp": L(kls, role="stamp", el="klasifikasi", s=True) if rahasia else None,
        "stamp_bottom": L(kls, role="stamp", el="klasifikasi", s=True) if rahasia else None,
    }
    els = ["kop_satuan", "surat_telegram", "blok_alamat"] + ([kls_el] if kls_el else []) + ([drj_el] if drj_el else [])
    meta = {
        "has_dinas_doc": True,
        "doc_elements": els,
        "neg_type": None,
        "expected_risk": "tinggi",
        "notes": f"{template_id}: klasifikasi {kls}, derajat {drj}, nomor {nomor.split('/')[0]}, "
        f"ruang klasifikasi {ctx['cls_pos']}, kop {len(u['kop'])} baris, {style['font']}",
    }
    return Content(template_id, template_id.replace("-", "_"), ctx, meta)


# --------------------------------------------------------------------------- surat biasa satuan
def _sb(template_id: str, rng: random.Random) -> Content:
    d = fiktif()
    variant = template_id[-1]
    style = _style(rng, "serif" if variant == "a" else "sans", (21, 24))
    upper_labels = variant == "b"
    u = _unit(rng)
    rahasia = rng.random() < 0.5
    keg = _kegiatan(rng)
    nomor = f"{'R' if rahasia else 'B'}/{rng.randint(10, 999)}/{rng.choice(ROMAWI)}/{YEAR}"
    kls = "Rahasia" if rahasia else "Biasa"
    el_k = "klasifikasi" if rahasia else None

    def lab(s: str) -> str:
        return s.upper() if upper_labels else s

    def val(s: str) -> str:
        return s.upper() if upper_labels and s in ("Rahasia", "Biasa") else s

    kota = tc(u["kota"])
    n_isi = rng.randint(2, 3)
    body = [
        P(f"Dasar: surat {tc(u['atasan'])} Nomor B/{rng.randint(10, 999)}/{rng.choice(ROMAWI)}/{YEAR} "
          f"tanggal {_date(rng)} tentang {keg['judul']}.", prefix="1."),
        P(" ".join(keg["kalimat"][:n_isi]), prefix="2."),
        P("Sehubungan dengan hal tersebut, mohon kiranya pelaksanaan kegiatan dapat dikoordinasikan dengan bagian terkait.", prefix="3."),
        P(rng.choice(d["penutup_surat"]), prefix="4."),
    ]
    nama, pangkat = _person(rng)
    kepada_line = L(f"Kepada Yth. {tc(u['atasan'])}", role="kepada", el="blok_alamat", s=True)
    tembusan = [tc(u["staf"]), "Arsip"]
    rahasia_stamp = L("RAHASIA", role="stamp", el="klasifikasi", s=True) if rahasia else None
    ctx = {
        **style,
        "logo": _logo(),
        "kop": _kop_lines(u),
        "tempat_tgl": L(f"{kota}, {_date(rng)}", role="tanggal"),
        "fields": [
            R(lab("Nomor"), nomor, el=el_k, s=rahasia),
            R(lab("Klasifikasi"), val(kls), el=el_k, s=rahasia),
            R(lab("Lampiran"), rng.choice(["-", "1 (satu) berkas", "2 (dua) lembar"])),
            R(lab("Perihal"), _sentence_case(keg["judul"])),
        ],
        "kepada": [kepada_line, L("di", role="kepada"), L(kota, role="kepada")],
        "body": body,
        "ttd": [L(f"a.n. {tc(u['full'])}", role="ttd"), L(f"{tc(u['staf_jab'])},", role="ttd")],
        "ttd_nama": [L(tc(nama), role="ttd"), L(tc(pangkat), role="ttd")],
        "tembusan": [L(f"{lab('Tembusan')}:", role="tembusan", el="blok_alamat", s=True)]
        + [L(f"{i + 1}. {t}", role="tembusan") for i, t in enumerate(tembusan)],
        "stamp": rahasia_stamp,
        "stamp_bottom": dict(rahasia_stamp) if rahasia_stamp else None,
    }
    els = ["kop_satuan", "blok_alamat"] + (["klasifikasi"] if rahasia else [])
    notes = f"{template_id}: nomor {nomor.split('/')[0]}/…, klasifikasi {kls}, kop {len(u['kop'])} baris, {style['font']}"
    if not rahasia:
        notes += "; expected_risk mengikuti kartu T-29 (kop tanpa klasifikasi R → perhatian)"
    meta = {
        "has_dinas_doc": True,
        "doc_elements": els,
        "neg_type": None,
        "expected_risk": "tinggi" if rahasia else "perhatian",
        "notes": notes,
    }
    return Content(template_id, template_id.replace("-", "_"), ctx, meta)


def _kop_only(template_id: str, rng: random.Random) -> Content:
    style = _style(rng, rng.choice(["serif", "sans"]), (22, 26))
    u = _unit(rng, exact_lines=2)
    ctx = {**style, "logo": _logo(), "kop": _kop_lines(u), "align": rng.choice(["left", "center"])}
    meta = {
        "has_dinas_doc": True,
        "doc_elements": ["kop_satuan"],
        "neg_type": None,
        "expected_risk": "perhatian",
        "notes": f"kop-only: 2 baris, rata {ctx['align']}, {style['font']}",
    }
    return Content(template_id, "kop_only", ctx, meta)


# --------------------------------------------------------------------------- naskah sipil
def _civil(template_id: str, rng: random.Random) -> Content:
    d = fiktif()["sipil"]
    kind = "pemda" if template_id.endswith("a") else "kampus"
    style = _style(rng, "serif" if kind == "pemda" else "sans", (21, 24))
    inst = rng.choice(d[kind])
    upper_labels = rng.random() < 0.5  # sebagian memakai label kapital, seperti ruang naskah dinas
    lab = (lambda s: s.upper()) if upper_labels else (lambda s: s)  # noqa: E731
    sifat = rng.choice(["Segera", "Sangat Segera"])
    kls = rng.choice(["Terbatas", "Biasa"])
    show_kls = rng.random() < 0.8
    el_k = "klasifikasi" if show_kls and kls == "Terbatas" else None
    kota = rng.choice(["Kota Contoh", "Kabupaten Fiktif", "Kota Peragaan"])
    if kind == "pemda":
        nomor = f"{rng.choice(['000.1.2', '005', '400.3', '800'])}/{rng.randint(10, 999)}/{inst['kode']}/{YEAR}"
        kepada = rng.choice(["Kepala Perangkat Daerah se-Kabupaten Contoh", "Camat se-Kota Fiktif", "Kepala Bagian Umum"])
        tembusan = [rng.choice(["Bupati Contoh", "Wali Kota Fiktif"]), "Sekretaris Daerah", "Arsip"]
    else:
        nomor = f"{rng.randint(100, 9999)}/{inst['kode']}/TU/{YEAR}"
        kepada = rng.choice(["Para Ketua Program Studi", "Dosen dan Tenaga Kependidikan", "Ketua Himpunan Mahasiswa"])
        tembusan = ["Rektor Universitas Contoh", "Wakil Dekan Bidang Akademik", "Arsip"]
    val = (lambda s: s.upper()) if upper_labels else (lambda s: s)  # noqa: E731
    fields = [R(lab("Nomor"), nomor), R(lab("Sifat"), val(sifat), el="derajat")]
    fields.append(R(lab("Lampiran"), rng.choice(["-", "1 (satu) berkas"])))
    if show_kls:
        fields.append(R(lab("Klasifikasi"), val(kls), el=el_k))
    fields.append(R(lab("Perihal" if kind == "pemda" else "Hal"), rng.choice(d["perihal"])))
    kal = rng.sample(d["kalimat"], 3)
    ctx = {
        **style,
        "logo": _logo(),
        "kop": [L(inst["instansi"][0], role="kop"), L(inst["instansi"][1], role="kop")],
        "alamat": L(rng.choice(d["alamat"]), role="kop_alamat"),
        "tempat_tgl": L(f"{kota}, {_date(rng)}", role="tanggal"),
        "fields": fields,
        "kepada": [L("Kepada Yth.", role="kepada", el="blok_alamat"), L(kepada, role="kepada"), L(f"di {kota}", role="kepada")],
        "body": [P(kal[0]), P(f"{kal[1]} {kal[2]}"), P("Atas perhatian dan kerja samanya, kami ucapkan terima kasih.")],
        "ttd": [L(f"{inst['kepala']},", role="ttd")],
        "ttd_nama": [L(rng.choice(d["nama"]), role="ttd"), L(f"NIP 19990{rng.randint(1, 9)}{rng.randint(10, 28)} 2026{rng.randint(1, 9):02d} 1 0{rng.randint(10, 99)}", role="ttd")],
        "tembusan": [L(f"{lab('Tembusan')}:", role="tembusan", el="blok_alamat")]
        + [L(f"{i + 1}. {t}", role="tembusan") for i, t in enumerate(tembusan)],
    }
    els = (["klasifikasi"] if el_k else []) + ["derajat", "blok_alamat"]
    meta = {
        "has_dinas_doc": False,
        "doc_elements": els,
        "neg_type": "civil_naskah",
        "expected_risk": "perhatian",
        "notes": f"{template_id}: naskah {kind} fiktif, sifat {sifat}, klasifikasi {kls if show_kls else '-'}, "
        f"label {'kapital' if upper_labels else 'biasa'}, {style['font']}",
    }
    return Content(template_id, template_id.replace("-", "_"), ctx, meta)


# --------------------------------------------------------------------------- sehari-hari
def _everyday_meta(template_id: str, notes: str, trap: bool = False) -> dict:
    return {
        "has_dinas_doc": False,
        "doc_elements": [],
        "neg_type": "trap" if trap else "everyday",
        "expected_risk": "aman",
        "notes": f"{template_id}: {notes}",
    }


def _rt(template_id: str, rng: random.Random) -> Content:
    d = fiktif()["rt"]
    style = _style(rng, rng.choice(["serif", "sans"]), (22, 25))
    wil = rng.choice(d["wilayah"])
    rt_no = wil.split()[1]
    acara = rng.choice(d["acara"])
    ctx = {
        **style,
        "kop": [L(f"PENGURUS {wil}", role="kop"), L(rng.choice(d["kelurahan"]), role="kop"),
                L("Sekretariat: Pos Kamling, Jalan Kenanga Fiktif", role="kop_alamat")],
        "fields": [R("Nomor", f"0{rng.randint(10, 99)}/RT{rt_no}/{rng.choice(ROMAWI)}/{YEAR}"), R("Hal", acara["judul"])],
        "kepada": [L("Kepada Yth.", role="kepada"), L(f"Bapak/Ibu Warga RT {rt_no}", role="kepada"), L("di tempat", role="kepada")],
        "salam": L("Dengan hormat,"),
        "body": [P(acara["isi"])],
        "acara": [R("Hari/Tanggal", f"{rng.choice(['Sabtu', 'Minggu'])}, {_date(rng)}"),
                  R("Waktu", f"{rng.choice(['07.00', '08.00', '19.30'])} WIB s.d. selesai"),
                  R("Tempat", rng.choice(["Balai warga", "Lapangan RT", "Rumah Ketua RT"]))],
        "penutup": P("Atas perhatian dan partisipasi Bapak/Ibu, kami ucapkan terima kasih."),
        "ttd": [L(f"Ketua RT {rt_no},", role="ttd")],
        "ttd_nama": [L(rng.choice(d["ketua"]), role="ttd")],
    }
    return Content(template_id, "hn_rt", ctx, _everyday_meta(template_id, f"surat RT, {acara['judul']}, {style['font']}"))


def _sekolah(template_id: str, rng: random.Random) -> Content:
    d = fiktif()["sekolah"]
    style = _style(rng, rng.choice(["serif", "sans"]), (22, 25))
    hal = rng.choice(d["hal"])
    nama = rng.choice(d["nama"])
    ctx = {
        **style,
        "logo": _logo(),
        "kop": [L(nama, role="kop"), L("Jalan Pendidikan Contoh No. 9, Kota Fiktif", role="kop_alamat"),
                L("Surel: tu@sekolah-contoh.sch.example", role="kop_alamat")],
        "fields": [R("Nomor", f"421.{rng.randint(1, 5)}/0{rng.randint(10, 99)}/{YEAR}"), R("Lampiran", rng.choice(["-", "1 lembar"])), R("Hal", hal["judul"])],
        "kepada": [L("Kepada Yth.", role="kepada"), L("Bapak/Ibu Orang Tua/Wali Murid", role="kepada"), L("di tempat", role="kepada")],
        "body": [P("Dengan hormat,"), P(hal["isi"]), P("Demikian pemberitahuan ini kami sampaikan. Atas perhatiannya kami ucapkan terima kasih.")],
        "tempat_tgl": L(f"Kota Fiktif, {_date(rng)}", role="tanggal"),
        "ttd": [L("Kepala Sekolah,", role="ttd")],
        "ttd_nama": [L(rng.choice(d["kepala"]), role="ttd")],
    }
    return Content(template_id, "hn_sekolah", ctx, _everyday_meta(template_id, f"surat sekolah, {hal['judul']}, {style['font']}"))


def _undangan(template_id: str, rng: random.Random) -> Content:
    d = fiktif()["undangan"]
    style = _style(rng, "serif", (24, 28))
    p1, p2 = rng.choice(d["pasangan"])
    o1, o2 = rng.sample(d["ortu"], 2)
    hari = rng.choice(["Sabtu", "Minggu"])
    tgl = _date(rng)
    ctx = {
        **style,
        "head": L("Undangan Pernikahan", role="judul"),
        "intro": P("Dengan memohon rahmat Tuhan Yang Maha Esa, kami bermaksud menyelenggarakan pernikahan putra-putri kami:"),
        "pengantin": [L(p1, role="nama"), L(f"Putri dari {o1}", role="ortu"), L("&", role="nama"), L(p2, role="nama"), L(f"Putra dari {o2}", role="ortu")],
        "acara": [L("Akad Nikah", role="sub"), L(f"{hari}, {tgl}", role="acara"), L(f"Pukul {rng.choice(['08.00', '09.00'])} WIB", role="acara"),
                  L("Resepsi", role="sub"), L(f"{hari}, {tgl}", role="acara"), L(f"Pukul {rng.choice(['11.00 - 14.00', '19.00 - 21.00'])} WIB", role="acara"),
                  L("Tempat", role="sub"), L(rng.choice(d["tempat"]), role="acara")],
        "penutup": P("Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu."),
        "turut": L("Kami yang berbahagia, keluarga kedua mempelai", role="sub"),
    }
    return Content(template_id, "hn_undangan", ctx, _everyday_meta(template_id, f"undangan nikah, {style['font']}"))


def _struk(template_id: str, rng: random.Random) -> Content:
    d = fiktif()["struk"]
    style = _style(rng, "mono", (22, 25))
    items = rng.sample(d["barang"], rng.randint(4, 8))
    rows, total = [], 0
    for nama, harga in items:
        q = rng.randint(1, 3)
        total += q * harga
        rows.append(L(nama))
        rows.append(C(f"{q} x {_rupiah(harga)}", _rupiah(q * harga)))
    tunai = ((total // 50000) + 1) * 50000
    ctx = {
        **style,
        "head": [L(rng.choice(d["toko"]), role="judul"), L("Jl. Contoh Raya No. 99, Kota Fiktif"), L("Telp. (0999) 123-456")],
        "meta_rows": [C(f"{rng.randint(1, 28):02d}/{rng.randint(1, 12):02d}/{YEAR} {rng.randint(8, 21):02d}:{rng.randint(0, 59):02d}", f"Kasir: {rng.randint(1, 9):02d}"),
                      L(f"No. Transaksi {YEAR}{rng.randint(100000, 999999)}")],
        "rows": rows,
        "total": [C("TOTAL", _rupiah(total), role="total"), C("TUNAI", _rupiah(tunai)), C("KEMBALI", _rupiah(tunai - total))],
        "foot": [L("TERIMA KASIH ATAS KUNJUNGAN ANDA"), L("Barang yang sudah dibeli"), L("tidak dapat ditukar")],
    }
    return Content(template_id, "hn_struk", ctx, _everyday_meta(template_id, f"struk belanja {len(items)} barang, {style['font']}"))


def _menu(template_id: str, rng: random.Random) -> Content:
    d = fiktif()["menu"]
    style = _style(rng, rng.choice(["sans", "serif"]), (24, 28))
    mk = rng.sample(d["makanan"], rng.randint(3, 5))
    mn = rng.sample(d["minuman"], rng.randint(3, 5))
    fmt = rng.choice([lambda n: f"Rp{_rupiah(n)}", lambda n: f"{n // 1000}K"])
    ctx = {
        **style,
        "head": [L(rng.choice(d["nama"]), role="judul"), L(rng.choice(["Ngopi santai, harga bersahabat", "Masakan rumahan setiap hari", "Buka pukul 08.00 - 22.00"]), role="tagline")],
        "sections": [
            {"title": L("MAKANAN", role="sub"), "rows": [C(n, fmt(h)) for n, h in mk]},
            {"title": L("MINUMAN", role="sub"), "rows": [C(n, fmt(h)) for n, h in mn]},
        ],
        "foot": L(rng.choice(["Harga sudah termasuk pajak", "Bisa pesan antar lewat telepon", "Terima kasih sudah mampir"])),
    }
    return Content(template_id, "hn_menu", ctx, _everyday_meta(template_id, f"menu, {style['font']}"))


def _jebakan(template_id: str, rng: random.Random) -> Content:
    d = fiktif()["jebakan"]
    style = _style(rng, rng.choice(["sans", "serif"]), (30, 36))
    main, extra = rng.sample(d, 2)
    show_extra = rng.random() < 0.5
    ctx = {
        **style,
        "title": P(main["judul"], role="judul"),
        "sub": P(main["sub"], role="sub"),
        "isi": [L(s, role="isi") for s in main["isi"]],
        "extra": [P(extra["judul"], role="sub"), L(extra["sub"], role="isi")] if show_extra else [],
        "accent": rng.choice(["#b3261e", "#1d4e89", "#2e7d32", "#6a1b9a"]),
    }
    notes = f"poster '{main['judul']}'" + (f" + '{extra['judul']}'" if show_extra else "") + f", {style['font']}"
    return Content(template_id, "hn_jebakan", ctx, _everyday_meta(template_id, notes, trap=True))


_BUILDERS = {
    "st-a": _st, "st-b": _st, "st-c": _st,
    "sb-a": _sb, "sb-b": _sb,
    "kop-only": _kop_only,
    "hn-civil-a": _civil, "hn-civil-b": _civil,
    "hn-rt": _rt, "hn-sekolah": _sekolah, "hn-undangan": _undangan,
    "hn-struk": _struk, "hn-menu": _menu, "hn-jebakan": _jebakan,
}


def build_content(template_id: str, index: int, seed: int) -> Content:
    if template_id not in _BUILDERS:
        raise KeyError(f"template tidak dikenal: {template_id}")
    return _BUILDERS[template_id](template_id, item_rng(template_id, index, seed))
