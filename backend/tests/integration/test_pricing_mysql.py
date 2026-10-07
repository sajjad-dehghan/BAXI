import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import date, datetime, timezone

import pytest
from baxi.application import services as svc
from baxi.application.reports import run_report
from baxi.db.queries import execute, one
from mysql.connector import Error

pytestmark = pytest.mark.integration


def draft(**kwargs):
    return svc.TripDraft("baxi", (35.7005, 51.3376), (35.7112, 51.3786), **kwargs)


def test_quote_is_owned_bound_expiring_and_server_authoritative(accounts):
    cid = accounts["client"]
    trip = draft(payment="cash")
    offered = svc.issue_quote(cid, trip)
    seconds = (
        datetime.fromisoformat(offered["expires_at"]) - datetime.now(timezone.utc)
    ).total_seconds()
    assert 295 < seconds <= 300
    assert "commission_irr" not in offered
    with pytest.raises(ValueError, match="Invalid quote"):
        svc.create_request(accounts["female"], trip, offered["quote_id"])
    with pytest.raises(ValueError, match="Invalid quote"):
        svc.create_request(cid, trip, "f" * 32)
    for changed in [
        replace(trip, round_trip=True),
        replace(trip, dropoff=(35.72, 51.4)),
        replace(trip, cargo_weight=2),
        replace(trip, cargo_value=200),
        replace(trip, service="box"),
        replace(trip, cargo_type="fragile"),
    ]:
        with pytest.raises(ValueError, match="does not match"):
            svc.create_request(cid, changed, offered["quote_id"])
    execute(
        "UPDATE fare_quotes SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE id=%s",
        (offered["quote_id"],),
    )
    with pytest.raises(ValueError, match="Quote expired"):
        svc.create_request(cid, trip, offered["quote_id"])
    assert not one("SELECT id FROM service_requests WHERE client_id=%s", (cid,))


def test_concurrent_booking_and_lost_response_retries_have_one_snapshot(accounts):
    cid = accounts["client"]
    trip = draft(payment="cash")
    offered = svc.issue_quote(cid, trip)
    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(
            pool.map(
                lambda _: svc.create_request(cid, trip, offered["quote_id"]), range(2)
            )
        )
    assert ids[0] == ids[1]
    assert (
        one("SELECT COUNT(*) AS n FROM service_requests WHERE client_id=%s", (cid,))[
            "n"
        ]
        == 1
    )
    execute(
        "UPDATE fare_quotes SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 DAY WHERE id=%s",
        (offered["quote_id"],),
    )
    assert svc.create_request(cid, trip, offered["quote_id"]) == ids[0]
    svc.cancel_request(cid, ids[0])
    assert svc.create_request(cid, trip, offered["quote_id"]) == ids[0]
    with pytest.raises(Error, match="immutable"):
        execute(
            "UPDATE trip_pricing SET commission_bps=1000 WHERE request_id=%s", (ids[0],)
        )


@pytest.mark.parametrize("payment", ["wallet-to-wallet", "cash"])
def test_changed_policy_does_not_reprice_offer_settlement_or_reports(
    accounts, monkeypatch, payment
):
    cid, did = accounts["client"], accounts["driver"]
    original = svc.load_policy()
    custom = svc.load_policy()
    custom["version"] = "test-" + uuid.uuid4().hex
    for service in ("baxi", "women"):
        custom["services"][service]["commission_bps"] = 3333
        custom["services"][service]["base_irr"] += 200000
        custom["services"][service]["minimum_irr"] += 200000
    monkeypatch.setattr(svc, "load_policy", lambda: custom)
    trip = draft(payment=payment)
    offered = svc.issue_quote(cid, trip)
    monkeypatch.setattr(svc, "load_policy", lambda: original)
    fresh = svc.issue_quote(cid, trip)
    assert fresh["policy_version"] != offered["policy_version"]
    assert fresh["cost"] != offered["cost"]
    before_c, before_d = svc.balance(cid, "client"), svc.balance(did, "driver")
    rid = svc.create_request(cid, trip, offered["quote_id"])
    fare = offered["cost"]
    # The immutable snapshot is authoritative, even if an administrator edits a
    # legacy service-detail amount directly. All cost-view consumers agree.
    execute("UPDATE baxi_trips SET cost=1 WHERE request_id=%s", (rid,))
    assert (
        one("SELECT cost FROM trip_costs WHERE request_id=%s", (rid,))["cost"] == fare
    )
    expected_net = fare * 6667 // 10000
    svc.accept_request(did, rid)
    available = next(t for t in svc.history(did, "driver") if t["id"] == rid)
    assert available["driver_net_irr"] == expected_net
    assert (
        sum(l["amount_irr"] for l in json.loads(available["pricing_breakdown"])) == fare
    )
    svc.start_trip(did, rid)
    svc.complete_trip(did, rid, payment)
    svc.complete_trip(did, rid, payment)
    assert svc.balance(cid, "client") == before_c - (
        fare if payment == "wallet-to-wallet" else 0
    )
    assert svc.balance(did, "driver") == before_d + (
        expected_net if payment == "wallet-to-wallet" else -(fare - expected_net)
    )
    income = next(row for row in run_report(9001, 3)["rows"] if row["id"] == did)
    assert income["net_irr"] == expected_net
    svc.refresh_monthly_income(date.today().replace(day=1))
    assert (
        one("SELECT net_income FROM monthly_incomes WHERE driver_id=%s", (did,))[
            "net_income"
        ]
        == expected_net
    )


def test_version_reuse_is_rejected_and_cleanup_keeps_booked_quotes(accounts):
    policy = svc.load_policy()
    svc.register_pricing_policy(policy)
    policy["services"]["box"]["per_km_irr"] += 1
    with pytest.raises(ValueError, match="increment"):
        svc.register_pricing_policy(policy)
    cid = accounts["client"]
    trip = draft()
    booked = svc.issue_quote(cid, trip)
    rid = svc.create_request(cid, trip, booked["quote_id"])
    unused = svc.issue_quote(cid, trip)
    recent = svc.issue_quote(cid, trip)
    for quote_id in (booked["quote_id"], unused["quote_id"]):
        execute(
            "UPDATE fare_quotes SET expires_at=UTC_TIMESTAMP()-INTERVAL 2 DAY WHERE id=%s",
            (quote_id,),
        )
    svc.cleanup_quotes()
    assert one("SELECT id FROM fare_quotes WHERE id=%s", (booked["quote_id"],))
    assert not one("SELECT id FROM fare_quotes WHERE id=%s", (unused["quote_id"],))
    assert one("SELECT id FROM fare_quotes WHERE id=%s", (recent["quote_id"],))
    assert (
        one("SELECT cost FROM trip_costs WHERE request_id=%s", (rid,))["cost"]
        == booked["cost"]
    )


def test_legacy_fare_is_preserved_without_invented_breakdown(accounts):
    cid, did = accounts["client"], accounts["driver"]
    trip = draft()
    offered = svc.issue_quote(cid, trip)
    rid = svc.create_request(cid, trip, offered["quote_id"])
    # Reproduce a pre-migration record: no pricing snapshot and an odd IRR amount.
    execute("DELETE FROM trip_pricing WHERE request_id=%s", (rid,))
    execute("UPDATE baxi_trips SET cost=123457 WHERE request_id=%s", (rid,))
    old = next(t for t in svc.history(cid, "client") if t["id"] == rid)
    assert old["cost"] == 123457 and old["pricing_breakdown"] is None
    assert old["policy_version"] is None
    before = svc.balance(did, "driver")
    svc.accept_request(did, rid)
    svc.start_trip(did, rid)
    svc.complete_trip(did, rid)
    assert svc.balance(did, "driver") == before + 123457 * 8 // 10
