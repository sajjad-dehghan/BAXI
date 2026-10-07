"""Explicit, cached, Tehran-only place search for the single-process demo."""

import os
import time
from collections import OrderedDict
from threading import Lock

import requests

from service_area import AREA, in_tehran

_lock = Lock()
_cache = OrderedDict()
_last_request = 0.0


def search_places(query):
    global _last_request
    query = " ".join(str(query).split())
    if not 2 <= len(query) <= 120:
        raise ValueError("نام خیابان یا مکان عمومی را در ۲ تا ۱۲۰ حرف وارد کنید.")
    provider = os.getenv(
        "BAXI_GEOCODER_URL", "https://nominatim.openstreetmap.org"
    ).rstrip("/")
    key = (provider, query)
    if not _lock.acquire(blocking=False):
        raise ValueError("جست‌وجوی قبلی هنوز تمام نشده؛ چند لحظه بعد تلاش کنید.")
    try:
        now = time.monotonic()
        cached = _cache.get(key)
        if cached and now - cached[0] < 86400:
            _cache.move_to_end(key)
            return cached[1]
        if now - _last_request < 1:
            raise ValueError("برای جست‌وجوی بعدی یک ثانیه صبر کنید.")
        _last_request = now
        west, south, east, north = AREA["properties"]["bbox"]
        try:
            response = requests.get(
                provider + "/search",
                params={
                    "q": query + ", تهران, ایران",
                    "format": "jsonv2",
                    "countrycodes": "ir",
                    "viewbox": f"{west},{north},{east},{south}",
                    "bounded": 1,
                    "limit": 5,
                    "accept-language": "fa",
                },
                headers={
                    "User-Agent": "BAXI-Tehran-Demo/2.0 (+https://github.com/sajjad-dehghan/BAXI)"
                },
                timeout=(3, 8),
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, list):
                raise ValueError("Invalid geocoder response")
            result = []
            for item in payload[:5]:
                lat, lon = float(item["lat"]), float(item["lon"])
                if in_tehran(lat, lon):
                    result.append(
                        {
                            "label": "، ".join(
                                str(item["display_name"]).split(",")[:3]
                            )[:240],
                            "point": [lat, lon],
                        }
                    )
        except (requests.RequestException, ValueError, KeyError, TypeError) as error:
            raise ValueError(
                "جست‌وجوی مکان در دسترس نیست؛ نقطه را از روی نقشه انتخاب کنید."
            ) from error
        _cache[key] = (now, result)
        while len(_cache) > 256:
            _cache.popitem(last=False)
        return result
    finally:
        _lock.release()
