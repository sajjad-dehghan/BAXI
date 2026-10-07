"""Shared, versioned Tehran city boundary; GeoJSON uses longitude first."""

import json
import math

from config import ROOT

AREA = json.loads((ROOT / "public" / "tehran-area.json").read_text(encoding="utf-8"))


def _in_ring(latitude, longitude, ring):
    inside = False
    ax, ay = ring[-1]
    for bx, by in ring:
        cross = (longitude - ax) * (by - ay) - (latitude - ay) * (bx - ax)
        if (
            abs(cross) < 1e-12
            and min(ax, bx) <= longitude <= max(ax, bx)
            and min(ay, by) <= latitude <= max(ay, by)
        ):
            return True
        if (ay > latitude) != (by > latitude) and longitude < (
            (bx - ax) * (latitude - ay) / (by - ay) + ax
        ):
            inside = not inside
        ax, ay = bx, by
    return inside


def in_tehran(latitude, longitude):
    latitude, longitude = float(latitude), float(longitude)
    if not math.isfinite(latitude) or not math.isfinite(longitude):
        return False
    outer, *holes = AREA["geometry"]["coordinates"]
    return _in_ring(latitude, longitude, outer) and not any(
        _in_ring(latitude, longitude, ring) for ring in holes
    )


def require_tehran(latitude, longitude):
    if not in_tehran(latitude, longitude):
        raise ValueError("Service is available only within Tehran city.")
