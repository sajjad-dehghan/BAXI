"""Offline reverse geocoding and straight-line fare estimates, in IRR."""

import math

import requests
from geopy.distance import geodesic

from baxi.core.config import settings
from baxi.geo.service_area import require_tehran
from baxi.pricing.engine import calculate


def coordinates(latitude, longitude):
    lat, lon = float(latitude), float(longitude)
    if (
        not math.isfinite(lat)
        or not math.isfinite(lon)
        or not -90 <= lat <= 90
        or not -180 <= lon <= 180
    ):
        raise ValueError(
            "Coordinates must be finite: latitude -90..90, longitude -180..180."
        )
    return lat, lon


def get_lat_lon_info(lat, lon):
    lat, lon = coordinates(lat, lon)
    cfg = settings()
    if cfg.demo:
        require_tehran(lat, lon)
        return {
            "state": "تهران",
            "city": "تهران",
            "formatted_address": f"Demo coordinates: {lat:.5f}, {lon:.5f}",
        }
    if not cfg.neshan_key:
        raise ValueError("Set NESHAN_API_KEY or enable BAXI_DEMO_MODE.")
    response = requests.get(
        "https://api.neshan.org/v5/reverse",
        params={"lat": lat, "lng": lon},
        headers={"Api-Key": cfg.neshan_key},
        timeout=(3, 8),
    )
    response.raise_for_status()
    result = response.json()
    if not isinstance(result, dict) or not all(
        isinstance(result.get(k), str) and result[k]
        for k in ("state", "city", "formatted_address")
    ):
        raise ValueError("The geocoding service returned an incomplete address.")
    return result


def trip_km(pickup, dropoff):
    return geodesic(coordinates(*pickup), coordinates(*dropoff)).km


def estimate_fare(
    service, pickup, dropoff, round_trip=False, cargo_value=0, cargo_weight=1
):
    estimate = calculate(service, trip_km(pickup, dropoff), round_trip, cargo_weight)
    return estimate["cost"], 0
