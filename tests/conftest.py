import os
import uuid

import pytest


def pytest_collection_modifyitems(config, items):
    if os.getenv("BAXI_RUN_INTEGRATION") != "1":
        for item in items:
            if "integration" in item.keywords:
                item.add_marker(
                    pytest.mark.skip(
                        reason="Set BAXI_RUN_INTEGRATION=1 for a disposable local MySQL database."
                    )
                )


@pytest.fixture
def accounts():
    from config import settings

    if settings().host not in {"127.0.0.1", "localhost"}:
        pytest.fail("Integration fixtures only support a disposable local database.")
    import services as svc
    from database import execute, rows, transaction
    from scripts.seed_demo import DOCUMENTS

    clients, drivers, staff_ids = [], [], []

    def phone():
        return "9" + str(uuid.uuid4().int % 10**9).zfill(9)

    try:
        for sex in ("M", "F"):
            clients.append(
                svc.register_client(phone(), "Test", "Synthetic", "1990-05-23", sex)
            )
        for i, (sex, service) in enumerate(
            [("M", "baxi"), ("M", "baxi"), ("F", "women"), ("M", "box"), ("M", "baar")]
        ):
            driver = svc.register_driver(
                phone(),
                "Test",
                "Synthetic",
                "1990-05-23",
                sex,
                "IR" + str(uuid.uuid4().int % 10**24).zfill(24),
                "0000000000",
                DOCUMENTS,
                {
                    "name": "Synthetic",
                    "color": "white",
                    "plate": uuid.uuid4().hex[:16],
                    "capacity": 100,
                    "year": 2020,
                    "fuel": "gasoline",
                },
                service,
            )
            execute(
                "UPDATE drivers SET verification_status='approved',final_verification_date=CURDATE(),wallet_balance=1000000,latitude=35.7005,longitude=51.3376 WHERE id=%s",
                (driver["id"],),
            )
            drivers.append(driver)
        for client in clients:
            svc.demo_transfer(client["id"], "client", 10000000)
        yield {
            "client": clients[0]["id"],
            "female": clients[1]["id"],
            "driver": drivers[0]["id"],
            "other_driver": drivers[1]["id"],
            "female_driver": drivers[2]["id"],
            "box": drivers[3]["id"],
            "baar": drivers[4]["id"],
            "staff_ids": staff_ids,
        }
    finally:
        # Delete only IDs created by this fixture, never a reset/truncate of shared data.
        client_ids = [c["id"] for c in clients]
        driver_ids = [d["id"] for d in drivers]
        with transaction():
            for cid in client_ids:
                for request in rows(
                    "SELECT id FROM service_requests WHERE client_id=%s", (cid,)
                ):
                    rid = request["id"]
                    for table in (
                        "trip_pricing",
                        "compliments",
                        "complaints",
                        "service_acceptances",
                        "destinations",
                        "baxi_trips",
                        "heavy_transports",
                        "light_transports",
                    ):
                        execute(f"DELETE FROM {table} WHERE request_id=%s", (rid,))
                execute("DELETE FROM service_requests WHERE client_id=%s", (cid,))
                execute("DELETE FROM reports WHERE client_id=%s", (cid,))
                execute("DELETE FROM addresses WHERE client_id=%s", (cid,))
                keys = rows(
                    "SELECT tracking_code FROM deposits WHERE client_id=%s", (cid,)
                )
                execute("DELETE FROM deposits WHERE client_id=%s", (cid,))
                for tx in keys:
                    execute(
                        "DELETE FROM transactions WHERE tracking_code=%s",
                        (tx["tracking_code"],),
                    )
                execute("DELETE FROM fare_quotes WHERE client_id=%s", (cid,))
                execute("DELETE FROM clients WHERE id=%s", (cid,))
            for did in driver_ids:
                for link in ("withdrawals", "compensatory_deposits"):
                    keys = rows(
                        f"SELECT tracking_code FROM {link} WHERE driver_id=%s", (did,)
                    )
                    execute(f"DELETE FROM {link} WHERE driver_id=%s", (did,))
                    for tx in keys:
                        execute(
                            "DELETE FROM transactions WHERE tracking_code=%s",
                            (tx["tracking_code"],),
                        )
                execute(
                    "DELETE FROM referrals WHERE referrer_id=%s OR referred_id=%s",
                    (did, did),
                )
                execute("DELETE FROM reports WHERE driver_id=%s", (did,))
                execute("DELETE FROM monthly_incomes WHERE driver_id=%s", (did,))
                execute("DELETE FROM company_deposits WHERE driver_id=%s", (did,))
                execute("DELETE FROM drivers WHERE id=%s", (did,))
        for code in staff_ids:
            execute(
                "DELETE FROM employees WHERE personnel_code=%s", (code,), "baxi_staff"
            )
