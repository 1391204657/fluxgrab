# -*- coding: utf-8 -*-
"""China-platform media parse for FluxGrab (server-side, no user cookies).

Uses yt-dlp on the VPS, optional Netscape cookies under DATA_DIR, and a
lightweight Douyin HTML fallback. Returns Cobalt-compatible JSON so the
website can reuse the same download UI.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

DATA_DIR = os.environ.get("DATA_DIR", "/data")
COOKIES_DIR = os.environ.get("MEDIA_COOKIES_DIR", os.path.join(DATA_DIR, "cookies"))
COBALT_INTERNAL = os.environ.get("COBALT_INTERNAL_URL", "http://cobalt-api:9000/").rstrip("/") + "/"
# Optional: self-hosted Evil0ctal Douyin_TikTok_Download_API base, e.g. http://cn-api:80
# When set, used as Douyin/Kuaishou fallback. Leave empty to avoid external deps.
MEDIA_HYBRID_URL = (os.environ.get("MEDIA_HYBRID_URL") or "").rstrip("/")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

# Hosts we try to resolve server-side (cookie-free for end users).
CN_HOST_MARKERS = (
    "douyin.com",
    "iesdouyin.com",
    "bilibili.com",
    "b23.tv",
    "ixigua.com",
    "toutiao.com",
    "kuaishou.com",
    "chenzhongtech.com",
    "iqiyi.com",
    "iq.com",
    "haokan.baidu.com",
)

# Prefer Cobalt for these when yt-dlp fails (Cobalt lists bilibili).
COBALT_FALLBACK_MARKERS = (
    "bilibili.com",
    "b23.tv",
    "tiktok.com",
)


def host_of(url: str) -> str:
    try:
        return (urllib.parse.urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def is_cn_media_url(url: str) -> bool:
    host = host_of(url)
    if not host:
        return False
    return any(m in host for m in CN_HOST_MARKERS)


def _find_cookies_file() -> str | None:
    names = (
        "cookies.txt",
        "douyin.com_cookies.txt",
        "www.douyin.com_cookies.txt",
        "bilibili.com_cookies.txt",
        "www.bilibili.com_cookies.txt",
    )
    for base in (COOKIES_DIR, DATA_DIR):
        if not os.path.isdir(base):
            continue
        for name in names:
            path = os.path.join(base, name)
            if os.path.isfile(path) and os.path.getsize(path) > 32:
                return path
        try:
            for fn in os.listdir(base):
                low = fn.lower()
                if "cookie" in low and low.endswith(".txt"):
                    path = os.path.join(base, fn)
                    if os.path.isfile(path) and os.path.getsize(path) > 32:
                        return path
        except OSError:
            pass
    return None


def _safe_filename(title: str, ext: str = "mp4") -> str:
    name = re.sub(r'[\\/:*?"<>|\s]+', "_", (title or "video").strip())[:80]
    name = name.strip("._") or "video"
    if not name.lower().endswith(f".{ext}"):
        name = f"{name}.{ext}"
    return name


def _pick_best_format(info: dict) -> dict | None:
    formats = [f for f in (info.get("formats") or []) if isinstance(f, dict)]
    if not formats:
        url = info.get("url")
        if url and ".m4s" not in url:
            return {"url": url, "ext": info.get("ext") or "mp4", "height": None}
        return None

    def score(f: dict) -> tuple:
        u = f.get("url") or ""
        proto = (f.get("protocol") or "").lower()
        ext = (f.get("ext") or "").lower()
        if not u or u.startswith("dash:") or "manifest" in proto or proto in ("m3u8", "m3u8_native"):
            return (-1, 0, 0, 0)
        # Prefer progressive http(s) over fragmented m4s/DASH.
        frag_penalty = 0 if (ext in ("m4s", "mhtml") or ".m4s" in u) else 1
        vcodec = f.get("vcodec") or "none"
        acodec = f.get("acodec") or "none"
        has_v = vcodec != "none"
        has_a = acodec != "none"
        progressive = 2 if (has_v and has_a) else (1 if has_v else 0)
        height = f.get("height") or 0
        tbr = f.get("tbr") or f.get("vbr") or 0
        return (progressive, frag_penalty, height, tbr)

    ranked = sorted(formats, key=score, reverse=True)
    if not ranked or score(ranked[0])[0] < 1:
        return None
    best = ranked[0]
    # Web clients need a single progressive file. Video-only DASH (.m4s) is not usable
    # as a direct download — let Cobalt remux via tunnel instead.
    vcodec = best.get("vcodec") or "none"
    acodec = best.get("acodec") or "none"
    u = best.get("url") or ""
    if (acodec == "none" or ".m4s" in u) and vcodec != "none":
        # Look for any true progressive (A+V) first
        for f in ranked:
            if score(f)[0] >= 2 and score(f)[1] >= 1 and f.get("url"):
                return f
        return None
    if best.get("url"):
        return best
    if info.get("url") and ".m4s" not in (info.get("url") or ""):
        return {"url": info["url"], "ext": info.get("ext") or "mp4", "height": info.get("height")}
    return None


def _formats_for_client(info: dict) -> list[dict]:
    """Compact format list for desktop clients."""
    out: list[dict] = []
    seen: set[str] = set()
    for f in info.get("formats") or []:
        if not isinstance(f, dict):
            continue
        u = f.get("url")
        if not u or u.startswith("dash:"):
            continue
        vcodec = f.get("vcodec") or "none"
        if vcodec == "none":
            continue
        height = f.get("height") or 0
        label = f"{height}p" if height else (f.get("format_note") or f.get("format_id") or "video")
        key = f"{label}:{u[:80]}"
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "label": label,
                "url": u,
                "height": height or None,
                "ext": f.get("ext") or "mp4",
                "filesize": f.get("filesize") or f.get("filesize_approx"),
            }
        )
    out.sort(key=lambda x: x.get("height") or 0, reverse=True)
    return out[:12]


def parse_with_ytdlp(url: str) -> dict[str, Any] | None:
    try:
        import yt_dlp
    except ImportError:
        return None

    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 25,
        "http_headers": {"User-Agent": USER_AGENT, "Referer": url},
    }
    cookiefile = _find_cookies_file()
    if cookiefile:
        opts["cookiefile"] = cookiefile

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception:
        return None

    if not info:
        return None
    if info.get("_type") == "playlist" and info.get("entries"):
        info = info["entries"][0] or {}

    best = _pick_best_format(info)
    # Still expose format list for desktop even when no progressive URL
    formats_client = _formats_for_client(info)
    title = info.get("title") or "video"
    thumb = info.get("thumbnail")
    if not thumb and isinstance(info.get("thumbnails"), list) and info["thumbnails"]:
        thumb = info["thumbnails"][-1].get("url")

    if not best or not best.get("url"):
        # Desktop can still use yt-dlp locally; for API we need Cobalt/hybrid.
        # Return None so callers fall through — but attach meta via a soft miss.
        return None

    ext = best.get("ext") or info.get("ext") or "mp4"
    return {
        "status": "redirect",
        "url": best["url"],
        "filename": _safe_filename(title, ext if ext != "m4s" else "mp4"),
        "title": title,
        "thumbnail": thumb or "",
        "extractor": info.get("extractor_key") or info.get("extractor") or "",
        "formats": formats_client,
        "source": "ytdlp",
    }


def _http_get(url: str, *, timeout: int = 20, allow_redirects: bool = True) -> tuple[str, str]:
    """Return (final_url, text)."""
    opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler())
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/json,*/*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.douyin.com/",
        },
    )
    with opener.open(req, timeout=timeout) as resp:
        final = resp.geturl() if allow_redirects else url
        raw = resp.read(2_000_000)
        charset = resp.headers.get_content_charset() or "utf-8"
        return final, raw.decode(charset, errors="replace")


def _unescape_json_str(s: str) -> str:
    try:
        return json.loads(f'"{s}"')
    except Exception:
        return (
            s.replace("\\u002F", "/")
            .replace("\\/", "/")
            .replace("&amp;", "&")
            .replace("\\u0026", "&")
        )


def parse_douyin_html(url: str) -> dict[str, Any] | None:
    """Best-effort Douyin parse without cookies (public share pages)."""
    host = host_of(url)
    if "douyin.com" not in host and "iesdouyin.com" not in host:
        return None
    try:
        final, html = _http_get(url)
    except Exception:
        return None

    # Common patterns in Douyin web HTML / RENDER_DATA
    patterns = [
        r'"play_addr"\s*:\s*\{[^}]*?"url_list"\s*:\s*\[\s*"([^"]+)"',
        r'"playAddr"\s*:\s*"([^"]+)"',
        r'"download_addr"\s*:\s*\{[^}]*?"url_list"\s*:\s*\[\s*"([^"]+)"',
        r'"playApi"\s*:\s*"([^"]+)"',
        r'https://[^"\s\\]+douyinvod[^"\s\\]+\.mp4[^"\s\\]*',
        r'https://[^"\s\\]+douyin\.com[^"\s\\]+\.mp4[^"\s\\]*',
    ]
    video_url = ""
    for pat in patterns:
        m = re.search(pat, html, re.I)
        if m:
            video_url = m.group(1) if m.lastindex else m.group(0)
            break
    if not video_url:
        return None

    video_url = _unescape_json_str(video_url)
    if video_url.startswith("//"):
        video_url = "https:" + video_url

    title = "douyin"
    for pat in (
        r'"desc"\s*:\s*"([^"]{1,200})"',
        r'"title"\s*:\s*"([^"]{1,200})"',
        r"<title>([^<]+)</title>",
    ):
        m = re.search(pat, html)
        if m:
            title = _unescape_json_str(m.group(1)).strip() or title
            title = re.sub(r"\s*[-|].*$", "", title).strip() or title
            break

    thumb = ""
    for pat in (
        r'"cover"\s*:\s*\{[^}]*?"url_list"\s*:\s*\[\s*"([^"]+)"',
        r'property="og:image"\s+content="([^"]+)"',
    ):
        m = re.search(pat, html, re.I)
        if m:
            thumb = _unescape_json_str(m.group(1))
            if thumb.startswith("//"):
                thumb = "https:" + thumb
            break

    return {
        "status": "redirect",
        "url": video_url,
        "filename": _safe_filename(title),
        "title": title,
        "thumbnail": thumb,
        "extractor": "douyin_html",
        "formats": [{"label": "best", "url": video_url, "height": None, "ext": "mp4"}],
        "source": "douyin_html",
        "webpage_url": final,
    }


def _pick_from_hybrid_payload(data: dict, url: str) -> dict[str, Any] | None:
    """Normalize Evil0ctal / hybrid API JSON into Cobalt-compatible redirect."""
    if not isinstance(data, dict):
        return None
    # Common shapes: data.video_data / data.nwm_video_url / video_data
    nested = data.get("data") if isinstance(data.get("data"), dict) else data
    video = nested.get("video_data") if isinstance(nested.get("video_data"), dict) else nested
    candidates = [
        video.get("nwm_video_url_HQ") if isinstance(video, dict) else None,
        video.get("nwm_video_url") if isinstance(video, dict) else None,
        video.get("video_url") if isinstance(video, dict) else None,
        video.get("play") if isinstance(video, dict) else None,
        nested.get("nwm_video_url") if isinstance(nested, dict) else None,
        nested.get("video_url") if isinstance(nested, dict) else None,
        data.get("nwm_video_url"),
        data.get("video_url"),
    ]
    video_url = next((c for c in candidates if isinstance(c, str) and c.startswith("http")), "")
    if not video_url:
        # Bilibili-style
        for key in ("video_url", "download_url", "url"):
            v = nested.get(key) if isinstance(nested, dict) else None
            if isinstance(v, str) and v.startswith("http"):
                video_url = v
                break
    if not video_url:
        return None
    title = ""
    for src in (video, nested, data):
        if not isinstance(src, dict):
            continue
        title = src.get("desc") or src.get("title") or src.get("text") or title
        if title:
            break
    title = str(title or "video")[:120]
    thumb = ""
    for src in (video, nested, data):
        if not isinstance(src, dict):
            continue
        thumb = src.get("cover") or src.get("origin_cover") or src.get("thumbnail") or thumb
        if isinstance(thumb, dict):
            ul = thumb.get("url_list") or []
            thumb = ul[0] if ul else ""
        if thumb:
            break
    return {
        "status": "redirect",
        "url": video_url,
        "filename": _safe_filename(title),
        "title": title,
        "thumbnail": thumb if isinstance(thumb, str) else "",
        "extractor": "hybrid",
        "formats": [{"label": "best", "url": video_url, "height": None, "ext": "mp4"}],
        "source": "hybrid",
        "webpage_url": url,
    }


def parse_with_hybrid(url: str) -> dict[str, Any] | None:
    """Optional self-hosted Douyin/TikTok/Bilibili hybrid API (Evil0ctal-compatible)."""
    if not MEDIA_HYBRID_URL:
        return None
    qs = urllib.parse.urlencode({"url": url, "minimal": "true"})
    endpoint = f"{MEDIA_HYBRID_URL}/api/hybrid/video_data?{qs}"
    try:
        req = urllib.request.Request(
            endpoint,
            headers={"User-Agent": "FluxGrab-media-parse/1.0", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None
    return _pick_from_hybrid_payload(data, url)


def parse_with_cobalt(url: str) -> dict[str, Any] | None:
    payload = json.dumps(
        {
            "url": url,
            "videoQuality": "720",
            "filenameStyle": "basic",
            "alwaysProxy": True,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        COBALT_INTERNAL,
        data=payload,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "FluxGrab-media-parse/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            data = json.loads(exc.read().decode("utf-8", errors="replace"))
        except Exception:
            return None
    except Exception:
        return None

    if not isinstance(data, dict) or data.get("status") == "error":
        return None
    if data.get("status") in ("tunnel", "redirect") and data.get("url"):
        return {
            "status": data["status"],
            "url": data["url"],
            "filename": data.get("filename") or "video.mp4",
            "title": (data.get("filename") or "video").rsplit(".", 1)[0],
            "thumbnail": "",
            "extractor": "cobalt",
            "formats": [
                {
                    "label": "best",
                    "url": data["url"],
                    "height": None,
                    "ext": "mp4",
                }
            ],
            "source": "cobalt",
        }
    if data.get("status") == "picker" and data.get("picker"):
        data["source"] = "cobalt"
        return data
    return None


def parse_media(url: str) -> dict[str, Any]:
    """Parse a media URL. Prefer yt-dlp → Douyin HTML → Cobalt."""
    url = (url or "").strip()
    if not url:
        return {
            "status": "error",
            "error": {"code": "error.api.invalid_body", "text": "missing url"},
        }
    if not re.match(r"^https?://", url, re.I):
        return {
            "status": "error",
            "error": {"code": "error.api.invalid_body", "text": "invalid url"},
        }

    host = host_of(url)
    errors: list[str] = []

    result = parse_with_ytdlp(url)
    if result:
        return result
    errors.append("ytdlp")

    if MEDIA_HYBRID_URL and is_cn_media_url(url):
        result = parse_with_hybrid(url)
        if result:
            return result
        errors.append("hybrid")

    if "douyin.com" in host or "iesdouyin.com" in host:
        result = parse_douyin_html(url)
        if result:
            return result
        errors.append("douyin_html")

    if any(m in host for m in COBALT_FALLBACK_MARKERS) or is_cn_media_url(url):
        result = parse_with_cobalt(url)
        if result:
            return result
        errors.append("cobalt")

    need_cookies = "douyin.com" in host or "iesdouyin.com" in host or "ixigua.com" in host
    hint = (
        "Server cookies missing or expired — place Netscape cookies.txt in /data/cookies/ on the VPS"
        if need_cookies and not _find_cookies_file()
        else "Could not parse this link from the server"
    )
    return {
        "status": "error",
        "error": {
            "code": "error.api.fetch.fail",
            "text": hint,
            "tried": errors,
            "cookies": bool(_find_cookies_file()),
        },
    }
