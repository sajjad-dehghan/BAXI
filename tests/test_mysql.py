import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pytest
from mysql.connector import Error

import services as svc
from database import execute, one
from reports import REPORTS, run_report

pytestmark = pytest.mark.integration


def draft(service="baxi", **kwargs):
    return svc.TripDraft(service, (34.798, 48.515), (34.806, 48.53), **kwargs)


def finish(accounts, service="baxi"):
    cid = accounts["female"] if service == "women" else accounts["client"]
    driver = accounts[
        {"baxi": "driver", "women": "female_driver", "box": "box", "baar": "baar"}[
            service
        ]
    ]
    rid = svc.create_request(cid, draft(service))
    svc.accept_request(driver, rid)
    svc.start_trip(driver, rid)
    svc.complete_trip(driver, rid)
    return cid, driver, rid


@pytest.mark.parametrize("service", ["baxi", "women", "box", "baar"])
def test_complete_each_service_and_settle_exactly_once(accounts, service):
    cid = accounts["female"] if service == "women" else accounts["client"]
    driver = accounts[
        {"baxi": "driver", "women": "female_driver", "box": "box", "baar": "baar"}[
            service
        ]
    ]
    before_client, before_driver = (
        svc.balance(cid, "client"),
        svc.balance(driver, "driver"),
    )
    cid, driver, rid = finish(accounts, service)
    fare = one("SELECT cost FROM trip_costs WHERE request_id=%s", (rid,))["cost"]
    assert svc.balance(cid, "client") == before_client - fare
    assert svc.balance(driver, "driver") == before_driver + fare * 8 // 10
    svc.complete_trip(driver, rid)
    assert svc.balance(cid, "client") == before_client - fare
    assert (
        one("SELECT state FROM service_requests WHERE id=%s", (rid,))["state"]
        == "completed"
    )


def test_booking_rollback_on_destination_failure(accounts, monkeypatch):
    original = svc.execute

    def failing(sql, *args, **kwargs):
        if sql.startswith("INSERT INTO destinations"):
            raise RuntimeError("Synthetic failure")
        return original(sql, *args, **kwargs)

    monkeypatch.setattr(svc, "execute", failing)
    with pytest.raises(RuntimeError):
        svc.create_request(accounts["client"], draft())
    assert not one(
        "SELECT id FROM service_requests WHERE client_id=%s", (accounts["client"],)
    )


def test_two_drivers_compete_only_one_can_accept(accounts):
    rid = svc.create_request(accounts["client"], draft())

    def accept(driver):
        try:
            svc.accept_request(driver, rid)
            return True
        except ValueError:
            return False

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(accept, [accounts["driver"], accounts["other_driver"]]))
    assert sorted(results) == [False, True]


def test_women_driver_and_passenger_restrictions(accounts):
    with pytest.raises(ValueError):
        svc.create_request(accounts["client"], draft("women"))
    rid = svc.create_request(accounts["female"], draft("women"))
    with pytest.raises(ValueError):
        svc.accept_request(accounts["driver"], rid)
    assert rid not in [
        r["id"] for r in svc.available_requests(accounts["driver"], 34.798, 48.515)
    ]
    svc.accept_request(accounts["female_driver"], rid)


def test_longitude_latitude_nearby_boundary(accounts):
    # Eastward 0.05 degrees is ~4.57 km here, but ~5.56 km if lat/lon are swapped.
    rid = svc.create_request(
        accounts["client"], svc.TripDraft("baxi", (34.798, 48.565), (34.806, 48.57))
    )
    assert rid in [
        r["id"] for r in svc.available_requests(accounts["driver"], 34.798, 48.515)
    ]


def test_cargo_coordinates_and_capacity(accounts):
    rid = svc.create_request(accounts["client"], draft("box", cargo_weight=101))
    cargo = one("SELECT * FROM light_transports WHERE request_id=%s", (rid,))
    assert cargo["dropoff_latitude"] == 34.806 and cargo["dropoff_longitude"] == 48.53
    assert rid not in [
        r["id"] for r in svc.available_requests(accounts["box"], 34.798, 48.515)
    ]
    with pytest.raises(ValueError):
        svc.accept_request(accounts["box"], rid)


def test_cancel_state_and_ownership(accounts):
    rid = svc.create_request(accounts["client"], draft())
    with pytest.raises(ValueError):
        svc.cancel_request(accounts["female"], rid)
    svc.accept_request(accounts["driver"], rid)
    svc.cancel_request(accounts["client"], rid)
    with pytest.raises(ValueError):
        svc.start_trip(accounts["driver"], rid)


def test_insufficient_balance_rolls_back_trip_completion(accounts):
    rid = svc.create_request(accounts["client"], draft())
    svc.accept_request(accounts["driver"], rid)
    svc.start_trip(accounts["driver"], rid)
    execute("UPDATE clients SET wallet_balance=0 WHERE id=%s", (accounts["client"],))
    before = svc.balance(accounts["driver"], "driver")
    with pytest.raises(Error):
        svc.complete_trip(accounts["driver"], rid)
    assert svc.balance(accounts["driver"], "driver") == before
    assert not one(
        "SELECT request_id FROM service_acceptances WHERE request_id=%s", (rid,)
    )
    assert (
        one("SELECT state FROM service_requests WHERE id=%s", (rid,))["state"]
        == "in_progress"
    )


def test_wallet_retries_and_driver_withdrawal(accounts):
    cid, did = accounts["client"], accounts["driver"]
    before_client, before_driver = (
        svc.balance(cid, "client"),
        svc.balance(did, "driver"),
    )
    key = uuid.uuid4().hex
    svc.demo_transfer(cid, "client", 12345, key)
    svc.demo_transfer(cid, "client", 12345, key)
    assert svc.balance(cid, "client") == before_client + 12345
    svc.demo_transfer(did, "driver", 23456)
    assert svc.balance(did, "driver") == before_driver - 23456
    assert svc.balance(cid, "client") == before_client + 12345
    with pytest.raises(ValueError):
        svc.demo_transfer(cid, "client", -1)


def test_recorded_cash_only_debits_driver_commission(accounts):
    cid, did = accounts["client"], accounts["driver"]
    before_client, before_driver = (
        svc.balance(cid, "client"),
        svc.balance(did, "driver"),
    )
    rid = svc.create_request(cid, draft())
    svc.accept_request(did, rid)
    svc.start_trip(did, rid)
    svc.complete_trip(did, rid, "cash")
    fare = one("SELECT cost FROM trip_costs WHERE request_id=%s", (rid,))["cost"]
    assert svc.balance(cid, "client") == before_client
    assert svc.balance(did, "driver") == before_driver - (fare - fare * 8 // 10)


def test_pending_transaction_cannot_post_and_completed_is_immutable(accounts):
    key = uuid.uuid4().hex
    execute(
        "INSERT INTO transactions(tracking_code,shaba_number,amount,type) VALUES(%s,%s,123,'card-to-wallet')",
        (key, "IR" + "0" * 24),
    )
    try:
        with pytest.raises(Error):
            execute(
                "INSERT INTO deposits(tracking_code,client_id) VALUES(%s,%s)",
                (key, accounts["client"]),
            )
        execute(
            "UPDATE transactions SET state='completed' WHERE tracking_code=%s", (key,)
        )
        execute(
            "INSERT INTO deposits(tracking_code,client_id) VALUES(%s,%s)",
            (key, accounts["client"]),
        )
        with pytest.raises(Error):
            execute(
                "UPDATE transactions SET state='pending' WHERE tracking_code=%s", (key,)
            )
    finally:
        # Fixture removes the link/transaction after successful posting.
        if not one("SELECT tracking_code FROM deposits WHERE tracking_code=%s", (key,)):
            execute("DELETE FROM transactions WHERE tracking_code=%s", (key,))


def test_rating_ownership_and_single_use(accounts):
    cid, did, rid = finish(accounts)
    with pytest.raises(ValueError):
        svc.rate_trip(accounts["female"], "client", rid, 5)
    svc.rate_trip(cid, "client", rid, 0)
    svc.rate_trip(did, "driver", rid, 4)
    with pytest.raises(ValueError):
        svc.rate_trip(cid, "client", rid, 5)


def test_approval_and_rejection_persist(accounts):
    did = accounts["driver"]
    execute(
        "UPDATE drivers SET verification_status='pending',final_verification_date=NULL WHERE id=%s",
        (did,),
    )
    with pytest.raises(ValueError):
        svc.available_requests(did, 34.798, 48.515)
    svc.review_driver(9002, did, False, "Synthetic missing information")
    assert (
        one("SELECT verification_status FROM drivers WHERE id=%s", (did,))[
            "verification_status"
        ]
        == "rejected"
    )
    with pytest.raises(ValueError):
        svc.review_driver(9002, did, True)


def test_staff_permissions_and_hashed_new_password(accounts):
    args = (
        "New",
        "Synthetic",
        "1990-05-23",
        "IR" + str(uuid.uuid4().int % 10**24).zfill(24),
        "Synthetic!123",
        100,
    )
    with pytest.raises(ValueError):
        svc.hire_employee(9002, *args)
    code = svc.hire_employee(9001, *args)
    accounts["staff_ids"].append(code)
    assert svc.authenticate_staff(code, "Synthetic!123")["personnel_code"] == code
    assert one(
        "SELECT password FROM employees WHERE personnel_code=%s", (code,), "baxi_staff"
    )["password"].startswith("scrypt$")


def test_equal_fares_not_deduplicated_in_monthly_income(accounts):
    _, did, rid = finish(accounts)
    finish(accounts)
    svc.refresh_monthly_income(date.today().replace(day=1))
    fare = one("SELECT cost FROM trip_costs WHERE request_id=%s", (rid,))["cost"]
    result = one("SELECT * FROM monthly_incomes WHERE driver_id=%s", (did,))
    assert result["gross_income"] == fare * 2
    assert result["net_income"] == (fare * 8 // 10) * 2


def test_all_twenty_reports_execute_and_compliance_is_empty(accounts):
    assert len(REPORTS) == 20
    for index in range(1, 21):
        assert isinstance(run_report(9001, index)["rows"], list)
    assert run_report(9001, 13)["rows"] == []
