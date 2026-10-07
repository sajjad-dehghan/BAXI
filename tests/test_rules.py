from dataclasses import FrozenInstanceError
from types import SimpleNamespace

import pytest

from generate_random_number import VerificationCodes
from get_lat_lon_info import coordinates, estimate_fare, get_lat_lon_info, trip_km
from security import hash_password, normalize_phone, verify_password
from services import TripDraft, birth_date, document_path, quote


@pytest.mark.parametrize(
    "phone",
    ["09123456780", "+989123456780", "00989123456780", "۹۱۲۳۴۵۶۷۸۰", " 0912-345-6780 "],
)
def test_phone_preserves_trailing_zero(phone):
    assert normalize_phone(phone) == "9123456780"


@pytest.mark.parametrize(
    "phone", ["", "0912", "08123456789", "091234567890", "9abcdefghj"]
)
def test_invalid_phone(phone):
    with pytest.raises(ValueError):
        normalize_phone(phone)


def test_password_hash_salted_and_no_plaintext_fallback():
    first, second = hash_password("Synthetic!123"), hash_password("Synthetic!123")
    assert first != second
    assert verify_password("Synthetic!123", first)
    assert not verify_password("incorrect", first)
    assert not verify_password("Synthetic!123", "Synthetic!123")


def test_otp_expiry_attempts_resend_single_use(monkeypatch):
    monkeypatch.setenv("BAXI_DEMO_MODE", "true")
    now = [100.0]
    codes = VerificationCodes(clock=lambda: now[0])
    code = codes.issue("09123456780")
    with pytest.raises(ValueError):
        codes.issue("09123456780")
    assert codes.verify("09123456780", code)
    assert not codes.verify("09123456780", code)
    now[0] += 31
    code = codes.issue("09123456780")
    for _ in range(5):
        assert not codes.verify("09123456780", "xxxxxx")
    assert not codes.verify("09123456780", code)
    now[0] += 31
    code = codes.issue("09123456780")
    now[0] += 120
    assert not codes.verify("09123456780", code)


def test_live_mode_does_not_issue_fake_otp(monkeypatch):
    monkeypatch.setenv("BAXI_DEMO_MODE", "false")
    with pytest.raises(ValueError):
        VerificationCodes().issue("09123456780")


@pytest.mark.parametrize(
    "pair", [(91, 0), (0, 181), (float("nan"), 1), (1, float("inf"))]
)
def test_invalid_coordinates(pair):
    with pytest.raises(ValueError):
        coordinates(*pair)


def test_drafts_do_not_share_or_accumulate_routes():
    first = TripDraft("baxi", (34.8, 48.5), (34.81, 48.51))
    second = TripDraft("baxi", (35.8, 51.5), (35.81, 51.51))
    assert quote(first)["cost"] != 0 and quote(second)["cost"] != 0
    assert first.pickup != second.pickup
    with pytest.raises(FrozenInstanceError):
        first.service = "box"


def test_fare_round_trip_insurance_and_fractional_distance():
    pickup, dropoff = (34.8, 48.5), (34.801, 48.501)
    fare, _ = estimate_fare("baxi", pickup, dropoff)
    back, _ = estimate_fare("baxi", pickup, dropoff, True)
    assert abs(back - 2 * fare) <= 1
    base, _ = estimate_fare("box", pickup, dropoff)
    insured, insurance = estimate_fare("box", pickup, dropoff, cargo_value=100000)
    assert insurance == 2000 and insured == base + 2000
    assert 0 < trip_km(pickup, dropoff) < 1


def test_birth_day_above_twelve_is_valid():
    assert birth_date("1995-05-23", 18).day == 23


def test_document_path_cannot_escape_workspace():
    with pytest.raises(ValueError):
        document_path("../../Windows/win.ini")


def test_geocoder_checks_status_timeout_and_payload(monkeypatch):
    monkeypatch.setenv("BAXI_DEMO_MODE", "false")
    monkeypatch.setenv("NESHAN_API_KEY", "synthetic-test-key")
    calls = []

    def fake_get(url, **kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            raise_for_status=lambda: None, json=lambda: {"city": "incomplete"}
        )

    monkeypatch.setattr("get_lat_lon_info.requests.get", fake_get)
    with pytest.raises(ValueError):
        get_lat_lon_info(34.8, 48.5)
    assert calls[0]["timeout"] == (3, 8)
