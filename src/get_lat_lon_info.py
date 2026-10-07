"""Offline reverse geocoding and straight-line fare estimates, in IRR."""

import math
from decimal import ROUND_HALF_UP, Decimal

import requests
from geopy.distance import geodesic

from config import settings
from service_area import require_tehran

RATES = {"baxi": 10000, "women": 10000, "box": 8000, "baar": 20000}


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
    return round(geodesic(coordinates(*pickup), coordinates(*dropoff)).km, 2)


def estimate_fare(service, pickup, dropoff, round_trip=False, cargo_value=0):
    if service not in RATES:
        raise ValueError("Unknown service")
    distance = Decimal(str(geodesic(coordinates(*pickup), coordinates(*dropoff)).km))
    fare = (distance * RATES[service] * (2 if round_trip else 1)).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    insurance = (
        (Decimal(cargo_value) * Decimal("0.02")).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
        if service == "box"
        else 0
    )
    return int(fare) + int(insurance), int(insurance)
